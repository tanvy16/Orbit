import { Activity, Cpu, FileStack, Layers, Search, Server } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { MetricCard } from '@/components/ui/MetricCard'
import { MetricCardSkeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusPill } from '@/components/ui/StatusPill'
import { healthLevelFromApiStatus } from '@/utils/health-status'
import { useApiHealth, useElectronPing } from '@/hooks/use-system-status'
import { appConfig } from '@/config/app'
import { fetchDocumentStats } from '@/services/documents-api'
import { fetchEmbeddingStatus, fetchSearchStats } from '@/services/search-api'
import { formatRelativeTime } from '@/utils/cn'

export function DashboardPage() {
  const health = useApiHealth()
  const ipc = useElectronPing()
  const docStats = useQuery({
    queryKey: ['document-stats'],
    queryFn: fetchDocumentStats,
    retry: 1,
  })
  const embedStats = useQuery({
    queryKey: ['embedding-status'],
    queryFn: fetchEmbeddingStatus,
    refetchInterval: 8000,
    retry: 1,
  })
  const searchStats = useQuery({
    queryKey: ['search-stats'],
    queryFn: fetchSearchStats,
    retry: 1,
  })

  const embedded = embedStats.data?.documentsEmbedded ?? 0
  const pending = embedStats.data?.documentsPending ?? 0
  const processing = embedStats.data?.documentsProcessing ?? 0
  const failed = embedStats.data?.documentsFailed ?? 0
  const queueTotal = embedded + pending + processing + failed
  const embedProgress =
    queueTotal === 0 ? 100 : Math.round((embedded / queueTotal) * 100)
  const vectorChunks = embedStats.data?.vectorChunks ?? embedStats.data?.totalEmbeddings ?? 0

  const apiLevel = health.data
    ? healthLevelFromApiStatus(health.data.status)
    : health.isError
      ? 'offline'
      : 'neutral'
  const chromaLevel = health.data?.chroma
    ? healthLevelFromApiStatus(health.data.chroma)
    : 'neutral'
  const ipcLevel = ipc.data ? 'healthy' : ipc.isError ? 'offline' : 'neutral'

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live view of indexing, embeddings, vector search, and system health."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {docStats.isLoading && !docStats.data ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Indexed documents"
              icon={FileStack}
              value={docStats.isError ? '—' : (docStats.data?.totalIndexed ?? '—')}
            />
            <MetricCard
              label="Vector chunks"
              icon={Layers}
              loading={embedStats.isLoading && !embedStats.data}
              value={embedStats.isError ? '—' : vectorChunks}
            />
            <MetricCard
              label="Embedded documents"
              icon={Cpu}
              loading={embedStats.isLoading && !embedStats.data}
              value={embedStats.isError ? '—' : embedded}
            />
            <MetricCard
              label="Semantic searches"
              icon={Search}
              value={searchStats.data?.totalQueries ?? 0}
            />
          </>
        )}
      </div>

      <Card className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold tracking-tight">Embedding progress</h2>
          </div>
          <StatusPill
            label={embedStats.data?.chromaOk ? 'Chroma online' : 'Chroma degraded'}
            level={embedStats.data?.chromaOk ? 'healthy' : 'warning'}
          />
        </div>
        {embedStats.isLoading && !embedStats.data ? (
          <div className="mt-6 space-y-3">
            <div className="h-2 animate-shimmer rounded-full bg-orbit-muted" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 animate-shimmer rounded bg-orbit-muted" />
              ))}
            </div>
          </div>
        ) : null}
        {embedStats.isError ? (
          <ErrorState
            compact
            className="mt-4 border-0 bg-transparent shadow-none"
            message={
              embedStats.error instanceof Error ? embedStats.error.message : 'Embedding status failed'
            }
            onRetry={() => void embedStats.refetch()}
          />
        ) : null}
        {embedStats.data ? (
          <>
            <ProgressBar
              className="mt-6"
              value={embedProgress}
              label={`${embedProgress}% documents embedded`}
            />
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-orbit-muted/40 px-3 py-2">
                <dt className="text-xs text-orbit-foreground-muted">Pending</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{pending}</dd>
              </div>
              <div className="rounded-lg bg-orbit-muted/40 px-3 py-2">
                <dt className="text-xs text-orbit-foreground-muted">Processing</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{processing}</dd>
              </div>
              <div className="rounded-lg bg-orbit-muted/40 px-3 py-2">
                <dt className="text-xs text-orbit-foreground-muted">Failed</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{failed}</dd>
              </div>
              <div className="rounded-lg bg-orbit-muted/40 px-3 py-2 md:col-span-1">
                <dt className="text-xs text-orbit-foreground-muted">Chroma path</dt>
                <dd className="mt-0.5 truncate text-xs font-medium">{embedStats.data.chromaPath ?? '—'}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-orbit-foreground-muted" />
                <h2 className="text-sm font-semibold">FastAPI backend</h2>
              </div>
              <p className="mt-1 text-xs text-orbit-foreground-muted">
                {appConfig.apiBaseUrl}/api/v1/health
              </p>
            </div>
            {health.data ? (
              <StatusPill label={health.data.status} level={apiLevel} />
            ) : null}
          </div>
          <div className="mt-5">
            {health.isLoading && !health.data ? (
              <div className="space-y-3">
                <div className="h-3 w-full animate-shimmer rounded-lg bg-orbit-muted" />
                <div className="h-3 w-[70%] animate-shimmer rounded-lg bg-orbit-muted" />
              </div>
            ) : null}
            {health.isError ? (
              <ErrorState
                compact
                className="mt-0 border-0 bg-transparent p-0 shadow-none"
                message={health.error instanceof Error ? health.error.message : 'Unknown error'}
                onRetry={() => void health.refetch()}
              />
            ) : null}
            {health.data ? (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-orbit-foreground-muted">Database</dt>
                  <dd className="mt-1">
                    <StatusPill
                      label={health.data.database}
                      level={healthLevelFromApiStatus(health.data.database)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-orbit-foreground-muted">Chroma</dt>
                  <dd className="mt-1">
                    <StatusPill label={health.data.chroma ?? '—'} level={chromaLevel} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-orbit-foreground-muted">Version</dt>
                  <dd className="mt-1 font-medium tabular-nums">{health.data.version}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-orbit-foreground-muted" />
                <h2 className="text-sm font-semibold">Electron IPC</h2>
              </div>
              <p className="mt-1 text-xs text-orbit-foreground-muted">Context-isolated preload bridge</p>
            </div>
            {ipc.data ? <StatusPill label="Connected" level={ipcLevel} /> : null}
          </div>
          <div className="mt-5">
            {ipc.isLoading && !ipc.data ? (
              <div className="space-y-3">
                <div className="h-3 w-full animate-shimmer rounded bg-orbit-muted" />
                <div className="h-3 w-[50%] animate-shimmer rounded-lg bg-orbit-muted" />
              </div>
            ) : null}
            {ipc.isError ? (
              <ErrorState
                compact
                title="IPC unavailable"
                className="mt-0 border-0 bg-transparent p-0 shadow-none"
                message={ipc.error instanceof Error ? ipc.error.message : 'Unknown error'}
                onRetry={() => void ipc.refetch()}
              />
            ) : null}
            {ipc.data ? (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-orbit-foreground-muted">Channel</dt>
                  <dd className="mt-1 font-medium">orbit:ping</dd>
                </div>
                <div>
                  <dt className="text-xs text-orbit-foreground-muted">Source</dt>
                  <dd className="mt-1 font-medium">{ipc.data.source}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-orbit-foreground-muted">Last ping</dt>
                  <dd className="mt-1">{formatRelativeTime(ipc.data.timestamp)}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  )
}
