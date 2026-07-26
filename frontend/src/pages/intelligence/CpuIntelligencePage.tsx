import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { HistoricalCompare } from '@/components/intelligence/HistoricalCompare'
import { IntelligenceDetailLayout } from '@/components/intelligence/IntelligenceDetailLayout'
import { MetricChart } from '@/components/intelligence/MetricChart'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/app'
import { fetchCpuIntelligence } from '@/services/intelligence-api'
import { formatDuration } from '@/utils/format-bytes'

export function CpuIntelligencePage() {
  const query = useQuery({ queryKey: ['intel-cpu'], queryFn: fetchCpuIntelligence, refetchInterval: 5000 })

  if (query.isError) {
    return (
      <IntelligenceDetailLayout title="CPU Intelligence" description="Per-core utilization and process analysis.">
        <ErrorState message={query.error instanceof Error ? query.error.message : 'Failed'} onRetry={() => void query.refetch()} />
      </IntelligenceDetailLayout>
    )
  }

  const metrics = query.data?.metrics as Record<string, unknown> | undefined
  const history = query.data?.history as { current: number; average: number; unusual: boolean; points: { value: number }[] } | undefined
  const topProcesses = (query.data?.topProcesses as Array<Record<string, unknown>>) ?? []

  return (
    <IntelligenceDetailLayout
      title="CPU Intelligence"
      description="Real-time CPU telemetry with professional charts and evidence-based analysis."
    >
      {query.isLoading ? <Skeleton className="mb-4 h-32" /> : null}
      {metrics?.aiSummary ? (
        <Card className="mb-6 border-orbit-accent/20 bg-orbit-accent/5">
          <h2 className="text-sm font-semibold">AI CPU summary</h2>
          <p className="mt-2 text-sm leading-relaxed">{String(metrics.aiSummary)}</p>
        </Card>
      ) : null}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Overall utilization</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{String(metrics?.usagePercent ?? '—')}%</p>
          <MetricChart values={(metrics?.loadHistory as number[]) ?? []} className="mt-4" />
          {history ? <div className="mt-4"><HistoricalCompare current={history.current} average={history.average} unusual={history.unusual} /></div> : null}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-orbit-foreground-muted">Physical cores</dt><dd>{String(metrics?.physicalCores ?? '—')}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Logical cores</dt><dd>{String(metrics?.logicalCores ?? '—')}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Current freq</dt><dd>{metrics?.frequencyMhz ? `${metrics.frequencyMhz} MHz` : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Base freq</dt><dd>{metrics?.baseFrequencyMhz ? `${metrics.baseFrequencyMhz} MHz` : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Threads</dt><dd>{String(metrics?.threadCount ?? '—')}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Uptime</dt><dd>{formatDuration(Number(metrics?.uptimeSeconds ?? 0))}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">History</h2>
          <MetricChart values={(history?.points ?? []).map((p) => p.value)} className="mt-4" />
        </Card>
      </div>
      <Card padding="none" className="overflow-hidden">
        <h2 className="border-b border-orbit-border px-5 py-4 text-sm font-semibold">Top CPU consumers</h2>
        <table className="min-w-full text-sm">
          <tbody>
            {topProcesses.map((row) => (
              <tr key={String(row.pid)} className="border-t border-orbit-border">
                <td className="px-4 py-2">
                  <Link to={`${routes.intelligence}/process/${row.pid}`} className="text-orbit-accent hover:underline">{String(row.name)}</Link>
                </td>
                <td className="px-4 py-2 tabular-nums">{String(row.cpuPercent)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </IntelligenceDetailLayout>
  )
}
