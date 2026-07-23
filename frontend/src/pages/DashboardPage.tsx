import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useApiHealth, useElectronPing } from '@/hooks/use-system-status'
import { appConfig } from '@/config/app'
import { formatRelativeTime } from '@/utils/cn'

export function DashboardPage() {
  const health = useApiHealth()
  const ipc = useElectronPing()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="System status for Orbit — backend, database, IPC, and desktop integration."
        actions={<Badge variant="accent">Phase 2</Badge>}
      />

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
                  <dt className="text-orbit-foreground-muted">Service</dt>
                  <dd>{health.data.service}</dd>
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
