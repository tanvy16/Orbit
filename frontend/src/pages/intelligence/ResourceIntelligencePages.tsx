import { useQuery } from '@tanstack/react-query'

import { IntelligenceDetailLayout } from '@/components/intelligence/IntelligenceDetailLayout'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { fetchBatteryIntelligence, fetchGpuIntelligence, fetchKernelIntelligence } from '@/services/intelligence-api'
import { formatBytes, formatDuration } from '@/utils/format-bytes'

export function GpuIntelligencePage() {
  const query = useQuery({ queryKey: ['intel-gpu'], queryFn: fetchGpuIntelligence, refetchInterval: 5000 })
  const gpu = query.data?.gpu as Record<string, unknown> | undefined

  return (
    <IntelligenceDetailLayout title="GPU Intelligence" description="Graphics processor utilization, thermals, and power.">
      <Card>
        {gpu?.available ? (
          <>
            <p className="text-4xl font-bold tabular-nums">{String(gpu.usagePercent ?? '—')}%</p>
            <ProgressBar className="mt-4" value={Number(gpu.usagePercent ?? 0)} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-orbit-foreground-muted">GPU</dt><dd>{String(gpu.name)}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">VRAM</dt><dd>{gpu.memoryUsedMb != null ? `${gpu.memoryUsedMb} / ${gpu.memoryTotalMb} MB` : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Temperature</dt><dd>{gpu.temperatureCelsius != null ? `${gpu.temperatureCelsius}°C` : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Clock</dt><dd>{gpu.clockMhz != null ? `${gpu.clockMhz} MHz` : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Power</dt><dd>{gpu.powerWatts != null ? `${gpu.powerWatts} W` : '—'}</dd></div>
            </dl>
          </>
        ) : (
          <div className="text-sm text-orbit-foreground-muted">
            <p className="font-medium text-orbit-foreground">GPU telemetry unavailable</p>
            <p className="mt-2">{String(gpu?.unavailableReason ?? 'No supported GPU collector on this system.')}</p>
          </div>
        )}
      </Card>
    </IntelligenceDetailLayout>
  )
}

export function BatteryIntelligencePage() {
  const query = useQuery({ queryKey: ['intel-battery'], queryFn: fetchBatteryIntelligence, refetchInterval: 10_000 })
  const bat = query.data?.battery as Record<string, unknown> | undefined

  let recommendation = 'Battery metrics look normal for the current power state.'
  if (bat?.wearPercent != null && Number(bat.wearPercent) >= 15) {
    recommendation = `Battery wear is ~${bat.wearPercent}% based on design vs full charge capacity — consider monitoring long-term degradation.`
  } else if (bat?.available && !bat.charging && Number(bat.percent ?? 100) < 20) {
    recommendation = 'Battery is below 20% — connect power to avoid unexpected shutdown.'
  }

  return (
    <IntelligenceDetailLayout title="Battery Intelligence" description="Power state, health, and wear analysis.">
      <Card>
        {bat?.available ? (
          <>
            <p className="text-4xl font-bold tabular-nums">{String(bat.percent ?? '—')}%</p>
            <ProgressBar className="mt-4" value={Number(bat.percent ?? 0)} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-orbit-foreground-muted">Status</dt><dd>{bat.charging ? 'Charging' : 'On battery'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Remaining</dt><dd>{bat.secsLeft != null && !bat.charging ? formatDuration(Number(bat.secsLeft)) : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Health</dt><dd>{bat.healthPercent != null ? `${bat.healthPercent}%` : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Wear</dt><dd>{bat.wearPercent != null ? `${bat.wearPercent}%` : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Design capacity</dt><dd>{bat.designCapacityMwh != null ? `${bat.designCapacityMwh} mWh` : '—'}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Full charge</dt><dd>{bat.fullChargeCapacityMwh != null ? `${bat.fullChargeCapacityMwh} mWh` : '—'}</dd></div>
            </dl>
            <p className="mt-4 text-sm text-orbit-foreground-muted">{recommendation}</p>
          </>
        ) : (
          <p className="text-sm text-orbit-foreground-muted">{String(bat?.unavailableReason ?? 'No battery detected.')}</p>
        )}
      </Card>
    </IntelligenceDetailLayout>
  )
}

export function KernelIntelligencePage() {
  const query = useQuery({ queryKey: ['intel-kernel'], queryFn: fetchKernelIntelligence, refetchInterval: 15_000 })

  return (
    <IntelligenceDetailLayout title="Kernel Intelligence" description="Kernel pools, drivers, and system counters.">
      <Card className="mb-6">
        <h2 className="text-sm font-semibold">AI kernel summary</h2>
        <p className="mt-2 text-sm">{String(query.data?.aiSummary ?? '')}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-orbit-foreground-muted">Context switches</dt><dd>{query.data?.contextSwitches != null ? Number(query.data.contextSwitches).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Interrupts</dt><dd>{query.data?.interruptRate != null ? Number(query.data.interruptRate).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Paged pool</dt><dd>{query.data?.pagedPoolBytes != null ? formatBytes(Number(query.data.pagedPoolBytes)) : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Non-paged pool</dt><dd>{query.data?.nonPagedPoolBytes != null ? formatBytes(Number(query.data.nonPagedPoolBytes)) : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Kernel memory</dt><dd>{query.data?.kernelMemoryBytes != null ? formatBytes(Number(query.data.kernelMemoryBytes)) : '—'}</dd></div>
            <div><dt className="text-xs text-orbit-foreground-muted">Services</dt><dd>{String(query.data?.runningServices ?? '—')}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Running drivers (sample)</h2>
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
            {((query.data?.runningDrivers as string[]) ?? []).map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </Card>
      </div>
    </IntelligenceDetailLayout>
  )
}
