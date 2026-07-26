import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { IntelligenceDetailLayout } from '@/components/intelligence/IntelligenceDetailLayout'
import { Sparkline } from '@/components/monitor/Sparkline'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchProcessIntelligence } from '@/services/intelligence-api'
import { formatBytes, formatDuration } from '@/utils/format-bytes'

export function ProcessIntelligencePage() {
  const { pid } = useParams()
  const pidNum = Number(pid)

  const query = useQuery({
    queryKey: ['intel-process', pidNum],
    queryFn: () => fetchProcessIntelligence(pidNum),
    enabled: Number.isFinite(pidNum) && pidNum > 0,
    refetchInterval: 4000,
  })

  if (!Number.isFinite(pidNum) || pidNum <= 0) {
    return (
      <IntelligenceDetailLayout title="Process Intelligence" description="Invalid process ID.">
        <ErrorState message="Invalid process ID" />
      </IntelligenceDetailLayout>
    )
  }

  if (query.isError) {
    return (
      <IntelligenceDetailLayout title="Process Intelligence" description="Deep process inspection.">
        <ErrorState message={query.error instanceof Error ? query.error.message : 'Process unavailable'} onRetry={() => void query.refetch()} />
      </IntelligenceDetailLayout>
    )
  }

  const proc = query.data

  return (
    <IntelligenceDetailLayout
      title={proc ? proc.name : 'Process Intelligence'}
      description={proc ? `PID ${proc.pid} — detailed inspection and health classification.` : 'Loading…'}
    >
      {query.isLoading || !proc ? <Skeleton className="h-48" /> : (
        <>
          <Card className="mb-6 border-orbit-accent/20 bg-orbit-accent/5">
            <h2 className="text-sm font-semibold">AI process summary</h2>
            <p className="mt-2 text-sm leading-relaxed">{proc.aiSummary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {proc.classifications.map((c) => (
                <Badge key={c.label} variant="accent">
                  <span title={c.evidence}>{c.label}</span>
                </Badge>
              ))}
            </div>
          </Card>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-orbit-foreground-muted">PID</dt><dd>{proc.pid}</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">Parent PID</dt><dd>{proc.parentPid ?? '—'}</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">CPU</dt><dd>{proc.cpuPercent}%</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">Memory</dt><dd>{formatBytes(proc.memoryBytes)}</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">Threads</dt><dd>{proc.threadCount}</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">Handles</dt><dd>{proc.handleCount ?? '—'}</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">Runtime</dt><dd>{formatDuration(proc.runtimeSeconds)}</dd></div>
                <div><dt className="text-xs text-orbit-foreground-muted">User</dt><dd className="truncate">{proc.username ?? '—'}</dd></div>
              </dl>
              {proc.executablePath ? (
                <p className="mt-4 break-all text-xs text-orbit-foreground-muted">{proc.executablePath}</p>
              ) : null}
              {proc.commandLine ? (
                <p className="mt-2 break-all text-xs text-orbit-foreground-muted">{proc.commandLine}</p>
              ) : null}
              {proc.windowTitle ? (
                <p className="mt-2 text-sm"><span className="text-orbit-foreground-muted">Window:</span> {proc.windowTitle}</p>
              ) : null}
              {proc.digitalSignature?.available ? (
                <p className="mt-2 text-xs text-orbit-foreground-muted">Signature: {proc.digitalSignature.status}{proc.digitalSignature.signer ? ` · ${proc.digitalSignature.signer}` : ''}</p>
              ) : null}
              {(proc.diskReadBytes != null || proc.diskWriteBytes != null) ? (
                <p className="mt-2 text-xs text-orbit-foreground-muted">
                  Disk I/O: read {formatBytes(proc.diskReadBytes ?? 0)} · write {formatBytes(proc.diskWriteBytes ?? 0)}
                </p>
              ) : null}
            </Card>
            <Card>
              <h2 className="text-sm font-semibold">Memory trend</h2>
              <Sparkline
                values={(proc.memoryTrend ?? []).map((p) => p.memoryBytes / (1024 * 1024))}
                className="mt-4"
                strokeClassName="stroke-violet-400"
              />
              <h2 className="mt-4 text-sm font-semibold">Classifications & evidence</h2>
              <ul className="mt-2 space-y-2 text-xs">
                {proc.classifications.map((c) => (
                  <li key={c.label}><span className="font-medium">{c.label}:</span> {c.evidence}</li>
                ))}
              </ul>
            </Card>
          </div>
          {proc.connections?.length ? (
            <Card padding="none" className="overflow-hidden">
              <h2 className="border-b border-orbit-border px-5 py-4 text-sm font-semibold">Network connections</h2>
              <ul className="divide-y divide-orbit-border text-xs">
                {proc.connections.map((conn, i) => (
                  <li key={i} className="px-4 py-2">
                    {conn.localAddress} → {conn.remoteAddress ?? '—'} ({conn.status})
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </IntelligenceDetailLayout>
  )
}
