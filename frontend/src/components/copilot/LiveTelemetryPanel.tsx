import { Activity, Battery, Cpu, HardDrive, Monitor, Network } from 'lucide-react'
import { motion } from 'framer-motion'

import { TelemetryMetricCard } from '@/components/copilot/TelemetryMetricCard'
import type { TelemetryHistory } from '@/hooks/use-copilot-telemetry'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { formatBitrate, formatBytes } from '@/utils/format-bytes'
import { formatNetworkSpeed, formatSnapshotTime } from '@/services/monitoring-api'
import type { SystemMetricsSnapshot } from '@shared/types'

interface LiveTelemetryPanelProps {
  snapshot: SystemMetricsSnapshot | undefined
  history: TelemetryHistory | null
  isLoading: boolean
  pollIntervalMs: number
}

function normalizeSeries(values: number[]): number[] {
  if (values.length < 2) return values
  const peak = Math.max(...values, 1)
  return values.map((v) => (v / peak) * 100)
}

export function LiveTelemetryPanel({
  snapshot,
  history,
  isLoading,
  pollIntervalMs,
}: LiveTelemetryPanelProps) {
  if (isLoading && !snapshot) {
    return (
      <Card className="h-fit">
        <Spinner size="sm" label="Loading live telemetry…" />
      </Card>
    )
  }

  if (!snapshot) return null

  const gpuAvailable = snapshot.gpu.available && snapshot.gpu.usagePercent != null
  const batteryAvailable = snapshot.battery.available && snapshot.battery.percent != null

  return (
    <Card className="h-fit overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-orbit-accent" />
          <h3 className="text-sm font-semibold">System context</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="accent" className="normal-case tracking-normal">
            <motion.span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-orbit-accent"
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            Live
          </Badge>
          <span className="text-[11px] text-orbit-foreground-muted">
            {formatSnapshotTime(snapshot.timestamp)}
          </span>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-orbit-foreground-muted">
        Refreshes every {Math.round(pollIntervalMs / 1000)}s · light snapshot cache
      </p>

      <div className="mt-3 space-y-2">
        <TelemetryMetricCard
          icon={Cpu}
          label="CPU"
          value={snapshot.cpu.usagePercent}
          displayValue={`${snapshot.cpu.usagePercent.toFixed(1)}%`}
          history={history?.cpu ?? snapshot.cpu.loadHistory ?? []}
          subtitle={`${snapshot.cpu.coreCount} cores`}
        />

        <TelemetryMetricCard
          icon={HardDrive}
          label="RAM"
          value={snapshot.memory.usagePercent}
          displayValue={`${snapshot.memory.usagePercent.toFixed(1)}%`}
          history={history?.ram ?? []}
          subtitle={`${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}`}
        />

        {gpuAvailable ? (
          <TelemetryMetricCard
            icon={Monitor}
            label="GPU"
            value={snapshot.gpu.usagePercent ?? 0}
            displayValue={`${(snapshot.gpu.usagePercent ?? 0).toFixed(1)}%`}
            history={history?.gpu ?? []}
            subtitle={snapshot.gpu.name ?? 'GPU'}
          />
        ) : null}

        <TelemetryMetricCard
          icon={Network}
          label="Network"
          value={snapshot.network.downloadBytesPerSec}
          displayValue={formatBitrate(snapshot.network.downloadBytesPerSec)}
          history={normalizeSeries(history?.networkDown ?? [])}
          sparklineMax={100}
          strokeClassName="stroke-emerald-400"
          subtitle={formatNetworkSpeed(snapshot)}
        />

        <TelemetryMetricCard
          icon={Battery}
          label="Battery"
          value={batteryAvailable ? snapshot.battery.percent ?? 0 : 0}
          displayValue={
            batteryAvailable
              ? `${snapshot.battery.percent}%${snapshot.battery.charging ? ' ⚡' : ''}`
              : 'N/A'
          }
          history={batteryAvailable ? history?.battery ?? [] : []}
          subtitle={batteryAvailable ? (snapshot.battery.charging ? 'Charging' : 'On battery') : 'Desktop / no battery'}
        />

        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="rounded-lg border border-orbit-border/60 bg-orbit-background/40 px-3 py-2">
            <p className="text-orbit-foreground-muted">Storage</p>
            <p className="mt-0.5 font-semibold tabular-nums">{snapshot.disk.usagePercent.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-orbit-border/60 bg-orbit-background/40 px-3 py-2">
            <p className="text-orbit-foreground-muted">Processes</p>
            <p className="mt-0.5 font-semibold tabular-nums">{snapshot.processes.count}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
