import { Activity, Battery, Cpu, HardDrive, MemoryStick, Monitor, Network, RefreshCw } from 'lucide-react'

import { Sparkline } from '@/components/monitor/Sparkline'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMonitoringStream } from '@/hooks/use-monitoring-stream'
import { formatBitrate, formatBytes, formatDuration } from '@/utils/format-bytes'

function MonitorCardSkeleton() {
  return (
    <Card>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-4 h-12 w-full" />
    </Card>
  )
}

export function SystemMonitorPage() {
  const { data, isConnected, isLoading, error, reconnect } = useMonitoringStream()

  if (error && !data) {
    return (
      <>
        <PageHeader
          title="System Monitor"
          description="Live desktop intelligence — CPU, memory, storage, network, and processes."
        />
        <ErrorState message={error} onRetry={reconnect} />
      </>
    )
  }

  const cpu = data?.cpu
  const mem = data?.memory
  const disk = data?.disk
  const net = data?.network
  const bat = data?.battery
  const gpu = data?.gpu
  const procs = data?.processes

  return (
    <>
      <PageHeader
        title="System Monitor"
        description="Real-time metrics from your machine via the Orbit backend."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? 'default' : 'muted'}>
              {isConnected ? 'Live' : 'Reconnecting…'}
            </Badge>
            <Button variant="secondary" size="sm" onClick={reconnect}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {error && data ? (
        <p className="mb-4 text-sm text-orbit-danger">{error}</p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && !data ? (
          <>
            <MonitorCardSkeleton />
            <MonitorCardSkeleton />
            <MonitorCardSkeleton />
            <MonitorCardSkeleton />
            <MonitorCardSkeleton />
            <MonitorCardSkeleton />
          </>
        ) : (
          <>
            <Card className="transition-shadow duration-200 hover:shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-orbit-accent" />
                  <h2 className="text-sm font-semibold">CPU</h2>
                </div>
                <span className="text-2xl font-semibold tabular-nums">
                  {cpu?.usagePercent ?? '—'}%
                </span>
              </div>
              <Sparkline values={cpu?.loadHistory ?? []} className="mt-4" />
              <p className="mt-2 text-xs text-orbit-foreground-muted">
                {cpu?.coreCount ?? 0} logical cores
                {cpu?.frequencyMhz ? ` · ${cpu.frequencyMhz} MHz` : ''}
              </p>
              {cpu?.perCorePercent?.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {cpu.perCorePercent.slice(0, 16).map((pct, i) => (
                    <span
                      key={i}
                      className="rounded bg-orbit-muted/60 px-1.5 py-0.5 text-[10px] tabular-nums text-orbit-foreground-muted"
                      title={`Core ${i + 1}`}
                    >
                      {Math.round(pct)}%
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card className="transition-shadow duration-200 hover:shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-orbit-accent" />
                  <h2 className="text-sm font-semibold">Memory</h2>
                </div>
                <span className="text-2xl font-semibold tabular-nums">
                  {mem?.usagePercent ?? '—'}%
                </span>
              </div>
              <ProgressBar className="mt-4" value={mem?.usagePercent ?? 0} />
              <p className="mt-2 text-xs text-orbit-foreground-muted">
                {formatBytes(mem?.usedBytes ?? 0)} / {formatBytes(mem?.totalBytes ?? 0)} used
              </p>
              <ul className="mt-3 space-y-1">
                {(mem?.topProcesses ?? []).slice(0, 4).map((p) => (
                  <li
                    key={p.pid}
                    className="flex justify-between text-xs text-orbit-foreground-muted"
                  >
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="tabular-nums">{formatBytes(p.memoryBytes)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="transition-shadow duration-200 hover:shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-orbit-accent" />
                  <h2 className="text-sm font-semibold">Storage</h2>
                </div>
                <span className="text-2xl font-semibold tabular-nums">
                  {disk?.usagePercent ?? '—'}%
                </span>
              </div>
              <ProgressBar className="mt-4" value={disk?.usagePercent ?? 0} />
              <p className="mt-2 text-xs text-orbit-foreground-muted">
                {formatBytes(disk?.freeBytes ?? 0)} free of {formatBytes(disk?.totalBytes ?? 0)}
              </p>
            </Card>

            <Card className="transition-shadow duration-200 hover:shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Battery className="h-4 w-4 text-orbit-accent" />
                  <h2 className="text-sm font-semibold">Battery</h2>
                </div>
                <span className="text-2xl font-semibold tabular-nums">
                  {bat?.available && bat.percent != null ? `${bat.percent}%` : 'N/A'}
                </span>
              </div>
              {bat?.available ? (
                <>
                  <ProgressBar className="mt-4" value={bat.percent ?? 0} />
                  <p className="mt-2 text-xs text-orbit-foreground-muted">
                    {bat.charging ? 'Charging' : 'On battery'}
                    {bat.secsLeft != null && !bat.charging
                      ? ` · ~${formatDuration(bat.secsLeft)} remaining`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-orbit-foreground-muted">
                  No battery detected (desktop power).
                </p>
              )}
            </Card>

            <Card className="transition-shadow duration-200 hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-orbit-accent" />
                <h2 className="text-sm font-semibold">Network</h2>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-orbit-foreground-muted">Download</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBitrate(net?.downloadBytesPerSec ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-orbit-foreground-muted">Upload</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBitrate(net?.uploadBytesPerSec ?? 0)}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="transition-shadow duration-200 hover:shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-orbit-accent" />
                  <h2 className="text-sm font-semibold">GPU</h2>
                </div>
                <span className="text-2xl font-semibold tabular-nums">
                  {gpu?.available && gpu.usagePercent != null ? `${gpu.usagePercent}%` : 'N/A'}
                </span>
              </div>
              {gpu?.available ? (
                <>
                  <ProgressBar className="mt-4" value={gpu.usagePercent ?? 0} />
                  <p className="mt-2 text-xs text-orbit-foreground-muted">
                    {gpu.name}
                    {gpu.memoryUsedMb != null && gpu.memoryTotalMb != null
                      ? ` · ${gpu.memoryUsedMb.toFixed(0)} / ${gpu.memoryTotalMb.toFixed(0)} MB`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-orbit-foreground-muted">
                  GPU metrics unavailable on this system.
                </p>
              )}
            </Card>
          </>
        )}
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-orbit-border px-5 py-4">
          <Activity className="h-4 w-4 text-orbit-accent" />
          <h2 className="text-sm font-semibold">Running processes</h2>
          <span className="text-xs text-orbit-foreground-muted">
            {procs?.count ?? 0} total
          </span>
        </div>
        {isLoading && !procs ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[75%]" />
          </div>
        ) : (
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
                {(procs?.items ?? []).map((row) => (
                  <tr key={row.pid} className="border-t border-orbit-border hover:bg-orbit-muted/20">
                    <td className="px-4 py-2.5 font-medium">{row.name}</td>
                    <td className="px-4 py-2.5 tabular-nums text-orbit-foreground-muted">
                      {row.pid}
                    </td>
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
        )}
      </Card>
    </>
  )
}
