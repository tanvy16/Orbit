import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { useApiHealth, useElectronPing } from '@/hooks/use-system-status'
import { appConfig } from '@/config/app'
import { fetchDocumentStats } from '@/services/documents-api'
import { fetchEmbeddingStatus, fetchSearchStats } from '@/services/search-api'
import { formatRelativeTime } from '@/utils/cn'
import { useQuery } from '@tanstack/react-query'

export function DashboardPage() {
  const health = useApiHealth()
  const ipc = useElectronPing()
  const docStats = useQuery({ queryKey: ['document-stats'], queryFn: fetchDocumentStats })
  const embedStats = useQuery({
    queryKey: ['embedding-status'],
    queryFn: fetchEmbeddingStatus,
    refetchInterval: 8000,
  })
  const searchStats = useQuery({ queryKey: ['search-stats'], queryFn: fetchSearchStats })

  const embedTotal =
    (embedStats.data?.documentsEmbedded ?? 0) +
    (embedStats.data?.documentsPending ?? 0) +
    (embedStats.data?.documentsProcessing ?? 0)
  const embedProgress =
    embedTotal === 0
      ? 100
      : Math.round(((embedStats.data?.documentsEmbedded ?? 0) / embedTotal) * 100)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="System status — SQLite metadata, ChromaDB vectors, IPC, and semantic search."
        actions={<Badge variant="accent">Phase 3</Badge>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Indexed documents</p>
          <p className="mt-1 text-2xl font-semibold">{docStats.data?.totalIndexed ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Vector chunks</p>
          <p className="mt-1 text-2xl font-semibold">{embedStats.data?.totalEmbeddings ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Embedded documents</p>
          <p className="mt-1 text-2xl font-semibold">{embedStats.data?.documentsEmbedded ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Semantic searches</p>
          <p className="mt-1 text-2xl font-semibold">{searchStats.data?.totalQueries ?? 0}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Embedding progress</h2>
          <Badge variant={embedStats.data?.chromaOk ? 'default' : 'muted'}>
            Chroma {embedStats.data?.chromaOk ? 'online' : 'degraded'}
          </Badge>
        </div>
        {embedStats.isLoading ? (
          <Spinner className="mt-4" label="Loading embedding status…" />
        ) : (
          <>
            <ProgressBar className="mt-4" value={embedProgress} label={`${embedProgress}% documents embedded`} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <dt className="text-orbit-foreground-muted">Pending</dt>
                <dd>{embedStats.data?.documentsPending ?? 0}</dd>
              </div>
              <div>
                <dt className="text-orbit-foreground-muted">Processing</dt>
                <dd>{embedStats.data?.documentsProcessing ?? 0}</dd>
              </div>
              <div>
                <dt className="text-orbit-foreground-muted">Failed</dt>
                <dd>{embedStats.data?.documentsFailed ?? 0}</dd>
              </div>
              <div>
                <dt className="text-orbit-foreground-muted">Chroma path</dt>
                <dd className="truncate text-xs">{embedStats.data?.chromaPath ?? '—'}</dd>
              </div>
            </dl>
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">FastAPI backend</h2>
          <p className="mt-1 text-xs text-orbit-foreground-muted">
            {appConfig.apiBaseUrl}/api/v1/health
          </p>
          <div className="mt-4">
            {health.isLoading ? <Spinner label="Checking API…" /> : null}
            {health.isError ? (
              <ErrorState
                message={health.error instanceof Error ? health.error.message : 'Unknown error'}
                onRetry={() => void health.refetch()}
              />
            ) : null}
            {health.data ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-orbit-foreground-muted">Status</dt>
                  <dd className="font-medium capitalize">{health.data.status}</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Database</dt>
                  <dd className="font-medium capitalize">{health.data.database}</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Chroma</dt>
                  <dd className="font-medium capitalize">{health.data.chroma ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Version</dt>
                  <dd>{health.data.version}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Electron IPC</h2>
          <p className="mt-1 text-xs text-orbit-foreground-muted">Context-isolated preload bridge</p>
          <div className="mt-4">
            {ipc.isLoading ? <Spinner label="Pinging main process…" /> : null}
            {ipc.isError ? (
              <ErrorState
                title="IPC unavailable"
                message={ipc.error instanceof Error ? ipc.error.message : 'Unknown error'}
                onRetry={() => void ipc.refetch()}
              />
            ) : null}
            {ipc.data ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-orbit-foreground-muted">Channel</dt>
                  <dd className="font-medium">orbit:ping</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Source</dt>
                  <dd className="font-medium">{ipc.data.source}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-orbit-foreground-muted">Timestamp</dt>
                  <dd>{formatRelativeTime(ipc.data.timestamp)}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  )
}
