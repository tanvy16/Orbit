import { useQuery } from '@tanstack/react-query'
import { Activity, Gauge } from 'lucide-react'
import { useState } from 'react'

import { Sparkline } from '@/components/monitor/Sparkline'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMonitoringStream } from '@/hooks/use-monitoring-stream'
import { fetchIntelligenceOverview } from '@/services/intelligence-api'
import {
  fetchDiagnostics,
  fetchEventLog,
  fetchMetricHistory,
} from '@/services/observability-api'
import { formatRelativeTime } from '@/utils/cn'

export function DiagnosticsPage() {
  const [historyHours, setHistoryHours] = useState<1 | 24>(1)
  const monitor = useMonitoringStream()
  const intelligence = useQuery({
    queryKey: ['intelligence-overview-diag'],
    queryFn: fetchIntelligenceOverview,
    refetchInterval: 10_000,
  })
  const diagnostics = useQuery({
    queryKey: ['diagnostics'],
    queryFn: () => fetchDiagnostics(50),
    refetchInterval: 5000,
  })
  const events = useQuery({
    queryKey: ['event-log'],
    queryFn: () => fetchEventLog({ limit: 40 }),
    refetchInterval: 8000,
  })
  const cpuHistory = useQuery({
    queryKey: ['metric-history', 'cpu', historyHours],
    queryFn: () => fetchMetricHistory('cpu', historyHours),
    refetchInterval: 30_000,
  })
  const ramHistory = useQuery({
    queryKey: ['metric-history', 'ram', historyHours],
    queryFn: () => fetchMetricHistory('ram', historyHours),
    refetchInterval: 30_000,
  })

  const live = monitor.data

  return (
    <>
      <PageHeader
        title="Diagnostics"
        description="Development view of latency, AI pipeline timing, desktop execution, and persisted system metrics."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Live CPU</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{live?.cpu.usagePercent ?? '—'}%</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Live RAM</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{live?.memory.usagePercent ?? '—'}%</p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Network down</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {Math.round((live?.network.downloadBytesPerSec ?? 0) / 1024)} KB/s
          </p>
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Intelligence collection</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {intelligence.data?.collectionMs != null
              ? `${Math.round(intelligence.data.collectionMs)} ms`
              : '—'}
          </p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-orbit-foreground-muted">Historical metrics:</span>
        <Button
          size="sm"
          variant={historyHours === 1 ? 'primary' : 'secondary'}
          onClick={() => setHistoryHours(1)}
        >
          Last hour
        </Button>
        <Button
          size="sm"
          variant={historyHours === 24 ? 'primary' : 'secondary'}
          onClick={() => setHistoryHours(24)}
        >
          Last 24 hours
        </Button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">CPU — {historyHours === 1 ? 'last hour' : 'last 24 hours'}</h2>
          </div>
          {cpuHistory.isLoading ? <Skeleton className="h-12 w-full" /> : null}
          <Sparkline
            values={(cpuHistory.data?.points ?? []).map((p) => p.value)}
            className="mt-2"
          />
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">RAM — {historyHours === 1 ? 'last hour' : 'last 24 hours'}</h2>
          </div>
          {ramHistory.isLoading ? <Skeleton className="h-12 w-full" /> : null}
          <Sparkline
            values={(ramHistory.data?.points ?? []).map((p) => p.value)}
            className="mt-2"
            strokeClassName="stroke-violet-400"
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">Copilot pipeline timing</h2>
          </div>
          {diagnostics.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : null}
          <ul className="space-y-2 text-sm">
            {(diagnostics.data?.items ?? []).map((item, index) => (
              <li key={`${item.recordedAt}-${index}`} className="rounded-lg bg-orbit-muted/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.route ?? item.type ?? 'copilot'}</span>
                  <span className="text-xs text-orbit-foreground-muted">
                    {item.model ?? '—'}
                  </span>
                </div>
                {item.message ? (
                  <p className="mt-0.5 truncate text-xs text-orbit-foreground-muted">{item.message}</p>
                ) : null}
                {item.profile ? (
                  <p className="mt-1 text-[11px] tabular-nums text-orbit-foreground-muted">
                    {Object.entries(item.profile)
                      .slice(0, 6)
                      .map(([key, value]) => `${key}: ${value}ms`)
                      .join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Structured event log</h2>
          {events.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : null}
          <ul className="max-h-[420px] space-y-2 overflow-y-auto text-sm">
            {(events.data?.items ?? []).map((item) => (
              <li key={item.id} className="rounded-lg border border-orbit-border/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    [{item.category}] {item.action}
                  </span>
                  <span className="text-xs text-orbit-foreground-muted">
                    {item.timestamp ? formatRelativeTime(item.timestamp) : '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-orbit-foreground-muted">
                  {item.status}
                  {item.durationMs != null ? ` · ${Math.round(item.durationMs)}ms` : ''}
                  {item.verified != null ? ` · verified=${item.verified ? 'yes' : 'no'}` : ''}
                </p>
                {item.userCommand ? (
                  <p className="mt-1 truncate text-xs">{item.userCommand}</p>
                ) : null}
                {item.errorMessage ? (
                  <p className="mt-1 text-xs text-orbit-danger">{item.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
