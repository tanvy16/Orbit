import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { HistoricalCompare } from '@/components/intelligence/HistoricalCompare'
import { IntelligenceDetailLayout } from '@/components/intelligence/IntelligenceDetailLayout'
import { MetricChart } from '@/components/intelligence/MetricChart'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/app'
import { fetchIntelligenceHistory, fetchMemoryIntelligence } from '@/services/intelligence-api'
import { formatBytes } from '@/utils/format-bytes'

export function MemoryIntelligencePage() {
  const [hours, setHours] = useState(1)
  const query = useQuery({ queryKey: ['intel-memory'], queryFn: fetchMemoryIntelligence, refetchInterval: 5000 })
  const historyQuery = useQuery({
    queryKey: ['intel-history', 'ram', hours],
    queryFn: () => fetchIntelligenceHistory('ram', hours),
    refetchInterval: 30_000,
  })
  const historyStats = historyQuery.data

  if (query.isError) {
    return (
      <IntelligenceDetailLayout title="Memory Intelligence" description="RAM pressure, swap, and top consumers.">
        <ErrorState message={query.error instanceof Error ? query.error.message : 'Failed'} onRetry={() => void query.refetch()} />
      </IntelligenceDetailLayout>
    )
  }

  const metrics = query.data?.metrics as Record<string, unknown> | undefined
  const recommendations = (query.data?.recommendations as Array<{ severity: string; title: string; detail: string; action: string }>) ?? []
  const top = (metrics?.topProcesses as Array<{ pid: number; name: string; memoryBytes: number }>) ?? []

  return (
    <IntelligenceDetailLayout
      title="Memory Intelligence"
      description="Detailed memory breakdown, pressure detection, and reclaim opportunities."
    >
      <div className="mb-4 flex gap-2">
        {([1 / 60, 1, 24, 168] as const).map((h) => (
          <Button
            key={h}
            size="sm"
            variant={hours === h ? 'primary' : 'secondary'}
            onClick={() => setHours(h)}
          >
            {h < 1 ? 'Last minute' : h === 1 ? 'Last hour' : h === 24 ? 'Last day' : 'Last week'}
          </Button>
        ))}
      </div>
      {metrics?.aiSummary ? (
        <Card className="mb-6 border-orbit-accent/20 bg-orbit-accent/5">
          <h2 className="text-sm font-semibold">AI memory summary</h2>
          <p className="mt-2 text-sm">{String(metrics.aiSummary)}</p>
        </Card>
      ) : null}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Memory usage</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{String(metrics?.usagePercent ?? '—')}%</p>
          <ProgressBar className="mt-4" value={Number(metrics?.usagePercent ?? 0)} />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-orbit-foreground-muted">Working set</dt><dd>{formatBytes(Number(metrics?.workingSetBytes ?? 0))}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Cached</dt><dd>{formatBytes(Number(metrics?.cachedBytes ?? 0))}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Committed</dt><dd>{formatBytes(Number(metrics?.committedBytes ?? 0))}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Page file</dt><dd>{formatBytes(Number(metrics?.pageFileUsedBytes ?? 0))}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Swap</dt><dd>{formatBytes(Number(metrics?.swapUsedBytes ?? 0))}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Reclaimable est.</dt><dd>{formatBytes(Number(metrics?.reclaimableEstimateBytes ?? 0))}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Historical usage</h2>
          <MetricChart values={(historyStats?.points ?? []).map((p) => p.value)} className="mt-4" strokeClassName="stroke-violet-400" fillClassName="fill-violet-400/15" />
          {historyStats ? <div className="mt-4"><HistoricalCompare current={historyStats.current} average={historyStats.average} unusual={historyStats.unusual} /></div> : null}
        </Card>
      </div>
      {recommendations.length ? (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold">Recommendations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recommendations.map((r) => (
              <li key={r.title}>• <strong>{r.title}</strong> — {r.detail}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card padding="none" className="overflow-hidden">
        <h2 className="border-b border-orbit-border px-5 py-4 text-sm font-semibold">Top memory consumers</h2>
        {query.isLoading ? <Skeleton className="m-4 h-24" /> : (
          <table className="min-w-full text-sm">
            <tbody>
              {top.map((row) => (
                <tr key={row.pid} className="border-t border-orbit-border">
                  <td className="px-4 py-2">
                    <Link to={`${routes.intelligence}/process/${row.pid}`} className="text-orbit-accent hover:underline">{row.name}</Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-right">{formatBytes(row.memoryBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </IntelligenceDetailLayout>
  )
}
