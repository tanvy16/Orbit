import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  Battery,
  Brain,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Network,
  RefreshCw,
  Search,
} from 'lucide-react'

import { HealthScoreCard } from '@/components/intelligence/HealthScoreCard'
import { RecommendationsPanel } from '@/components/intelligence/RecommendationsPanel'
import { ResourceCard } from '@/components/intelligence/ResourceCard'
import { TimelinePanel } from '@/components/intelligence/TimelinePanel'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/app'
import { useMonitoringStream } from '@/hooks/use-monitoring-stream'
import { fetchIntelligenceOverview } from '@/services/intelligence-api'
import { formatBitrate, formatBytes, formatDuration } from '@/utils/format-bytes'

const MAX_HISTORY = 24

function pushHistory(values: number[], next: number): number[] {
  return [...values, Number.isFinite(next) ? next : 0].slice(-MAX_HISTORY)
}

export function SystemIntelligencePage() {
  const stream = useMonitoringStream()
  const [processQuery, setProcessQuery] = useState('')
  const [history, setHistory] = useState({
    cpu: [] as number[],
    ram: [] as number[],
    disk: [] as number[],
    netDown: [] as number[],
  })
  const seeded = useRef(false)

  const overviewQuery = useQuery({
    queryKey: ['intelligence-overview'],
    queryFn: fetchIntelligenceOverview,
    refetchInterval: 8000,
  })

  useEffect(() => {
    if (!stream.data) return
    setHistory((prev) => ({
      cpu: pushHistory(prev.cpu.length ? prev.cpu : stream.data!.cpu.loadHistory ?? [], stream.data!.cpu.usagePercent),
      ram: pushHistory(prev.ram, stream.data!.memory.usagePercent),
      disk: pushHistory(prev.disk, stream.data!.disk.usagePercent),
      netDown: pushHistory(prev.netDown, stream.data!.network.downloadBytesPerSec),
    }))
    seeded.current = true
  }, [stream.data])

  const data = stream.data
  const overview = overviewQuery.data
  const procs = data?.processes.items ?? overview?.processes.items ?? []

  const filteredProcesses = procs.filter((proc) => {
    const q = processQuery.trim().toLowerCase()
    if (!q) return true
    return proc.name.toLowerCase().includes(q) || String(proc.pid).includes(q)
  })

  if (overviewQuery.isError && !overview && !data) {
    return (
      <ErrorState
        message={overviewQuery.error instanceof Error ? overviewQuery.error.message : 'Failed to load intelligence'}
        onRetry={() => void overviewQuery.refetch()}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="System Intelligence"
        description="AI-powered desktop analysis — understand why your system behaves the way it does, not just what the numbers are."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="gap-1">
              <Brain className="h-3 w-3" />
              Intelligence Engine
            </Badge>
            <Badge variant={stream.isConnected ? 'default' : 'muted'}>
              {stream.isConnected ? 'Live' : 'Reconnecting…'}
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => { stream.reconnect(); void overviewQuery.refetch() }}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {overviewQuery.isLoading && !overview ? (
          <Skeleton className="h-48 lg:col-span-1" />
        ) : overview ? (
          <HealthScoreCard health={overview.health} />
        ) : null}
        <div className="lg:col-span-2">
          {overviewQuery.isLoading && !overview ? (
            <Skeleton className="h-48" />
          ) : overview ? (
            <RecommendationsPanel items={overview.recommendations} />
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!data && stream.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
        ) : (
          <>
            <ResourceCard
              to={`${routes.intelligence}/cpu`}
              icon={Cpu}
              title="CPU"
              value={`${data?.cpu.usagePercent ?? '—'}%`}
              subtitle={overview?.resources.cpu.summary}
              sparkline={data?.cpu.loadHistory ?? history.cpu}
            />
            <ResourceCard
              to={`${routes.intelligence}/memory`}
              icon={MemoryStick}
              title="Memory"
              value={`${data?.memory.usagePercent ?? '—'}%`}
              subtitle={overview?.resources.memory.summary ?? `${formatBytes(data?.memory.usedBytes ?? 0)} used`}
              sparkline={history.ram}
              strokeClassName="stroke-violet-400"
            />
            <ResourceCard
              to={`${routes.intelligence}/storage`}
              icon={HardDrive}
              title="Storage"
              value={`${data?.disk.usagePercent ?? '—'}%`}
              subtitle={`${formatBytes(data?.disk.freeBytes ?? 0)} free`}
              sparkline={history.disk}
              strokeClassName="stroke-cyan-400"
            />
            <ResourceCard
              to={`${routes.intelligence}/network`}
              icon={Network}
              title="Network"
              value={formatBitrate(data?.network.downloadBytesPerSec ?? 0)}
              subtitle={`↑ ${formatBitrate(data?.network.uploadBytesPerSec ?? 0)}`}
              sparkline={history.netDown}
              strokeClassName="stroke-sky-400"
            />
            <ResourceCard
              to={`${routes.intelligence}/gpu`}
              icon={Monitor}
              title="GPU"
              value={
                data?.gpu.available && data.gpu.usagePercent != null
                  ? `${data.gpu.usagePercent}%`
                  : 'N/A'
              }
              subtitle={data?.gpu.name ?? 'GPU metrics unavailable'}
            />
            <ResourceCard
              to={`${routes.intelligence}/battery`}
              icon={Battery}
              title="Battery"
              value={
                data?.battery.available && data.battery.percent != null
                  ? `${data.battery.percent}%`
                  : 'N/A'
              }
              subtitle={
                data?.battery.available
                  ? data.battery.charging
                    ? 'Charging'
                    : 'On battery'
                  : 'Desktop power'
              }
            />
          </>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {overview ? <TimelinePanel events={overview.timeline} searchable /> : null}
        <Card>
          <Link to={`${routes.intelligence}/kernel`} className="block">
            <h2 className="text-sm font-semibold">Kernel Intelligence</h2>
            <p className="mt-1 text-xs text-orbit-foreground-muted">
              Context switches, interrupts, services, and kernel-level counters.
            </p>
            <p className="mt-3 text-xs font-medium text-orbit-accent">Open kernel analysis →</p>
          </Link>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-orbit-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">Process intelligence</h2>
            <span className="text-xs text-orbit-foreground-muted">{procs.length} sampled</span>
          </div>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-orbit-foreground-muted" />
            <Input
              className="pl-9"
              placeholder="Search processes…"
              value={processQuery}
              onChange={(event) => setProcessQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-orbit-muted/40 text-left text-xs uppercase tracking-wide text-orbit-foreground-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Application</th>
                <th className="px-4 py-3 font-medium">PID</th>
                <th className="px-4 py-3 font-medium">CPU</th>
                <th className="px-4 py-3 font-medium">Memory</th>
                <th className="px-4 py-3 font-medium">Runtime</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.map((row) => (
                <tr key={row.pid} className="border-t border-orbit-border hover:bg-orbit-muted/20">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`${routes.intelligence}/process/${row.pid}`}
                      className="font-medium text-orbit-accent hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-orbit-foreground-muted">{row.pid}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.cpuPercent}%</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatBytes(row.memoryBytes)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-orbit-foreground-muted">
                    {formatDuration(row.runtimeSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {overview?.collectionMs != null ? (
        <p className="mt-4 text-xs text-orbit-foreground-muted">
          Intelligence collected in {Math.round(overview.collectionMs)}ms
        </p>
      ) : null}
    </>
  )
}
