import { useQuery } from '@tanstack/react-query'

import { fetchStartupStatus, pingElectron, type StartupStatusResponse } from '@/services/api-client'

export type ServiceState = 'pending' | 'ready' | 'error' | 'idle'

function resolveServiceState(
  value: string | undefined,
  queryLoading: boolean,
  queryFailed: boolean,
): ServiceState {
  if ((queryLoading || queryFailed) && !value) return 'pending'
  if (value === 'ready') return 'ready'
  if (value === 'error') return 'error'
  if (value === 'pending') return 'pending'
  if (!value) return 'pending'
  return 'idle'
}

export function useServiceStatus() {
  const startupQuery = useQuery({
    queryKey: ['startup-status'],
    queryFn: fetchStartupStatus,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 1500
      const allReady =
        data.backend === 'ready' &&
        data.chroma === 'ready' &&
        data.semanticSearch === 'ready' &&
        data.aiModels === 'ready' &&
        data.desktopBridge === 'ready' &&
        data.automation === 'ready'
      return allReady ? 30_000 : 2000
    },
    retry: 1,
  })

  const electronQuery = useQuery({
    queryKey: ['electron-ping'],
    queryFn: pingElectron,
    retry: 1,
    refetchInterval: (query) => (query.state.data ? 30_000 : 2000),
  })

  const data = startupQuery.data
  const backendUnreachable = startupQuery.isError && !data

  const electron: ServiceState = electronQuery.isLoading
    ? 'pending'
    : electronQuery.isError
      ? 'error'
      : electronQuery.data
        ? 'ready'
        : 'idle'

  const resolve = (key: keyof StartupStatusResponse) =>
    resolveServiceState(
      typeof data?.[key] === 'string' ? (data[key] as string) : undefined,
      startupQuery.isLoading,
      backendUnreachable,
    )

  return {
    isLoading: startupQuery.isLoading && !data,
    electron,
    backend: resolve('backend'),
    chroma: resolve('chroma'),
    semanticSearch: resolve('semanticSearch'),
    aiModels: resolve('aiModels'),
    desktopBridge: resolve('desktopBridge'),
    automation: resolve('automation'),
    backendError: data?.errors?.database ?? undefined,
    aiError: data?.errors?.ai ?? undefined,
  }
}
