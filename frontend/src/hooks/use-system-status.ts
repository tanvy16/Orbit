import { useQuery } from '@tanstack/react-query'

import { fetchHealth, pingElectron } from '@/services/api-client'

export function useApiHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 2,
    refetchInterval: 30_000,
  })
}

export function useElectronPing() {
  return useQuery({
    queryKey: ['electron-ping'],
    queryFn: pingElectron,
    retry: false,
  })
}
