import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { fetchMonitoringSnapshot } from '@/services/monitoring-api'
import type { SystemMetricsSnapshot } from '@shared/types'

const POLL_MS = 2500
/** Keep ~60s of chart history at the poll interval. */
const MAX_HISTORY = 24

export interface TelemetryHistory {
  cpu: number[]
  ram: number[]
  gpu: number[]
  networkDown: number[]
  networkUp: number[]
  battery: number[]
}

function pushHistory(values: number[], next: number): number[] {
  const clamped = Number.isFinite(next) ? next : 0
  return [...values, clamped].slice(-MAX_HISTORY)
}

function buildHistory(prev: TelemetryHistory | null, snap: SystemMetricsSnapshot): TelemetryHistory {
  const cpuFromServer = snap.cpu.loadHistory?.length ? snap.cpu.loadHistory : [snap.cpu.usagePercent]
  const cpu =
    prev && prev.cpu.length > 0
      ? pushHistory(prev.cpu, snap.cpu.usagePercent)
      : cpuFromServer.slice(-MAX_HISTORY)

  const gpuValue = snap.gpu.available && snap.gpu.usagePercent != null ? snap.gpu.usagePercent : 0
  const batteryValue =
    snap.battery.available && snap.battery.percent != null ? snap.battery.percent : 0

  return {
    cpu,
    ram: pushHistory(prev?.ram ?? [], snap.memory.usagePercent),
    gpu: snap.gpu.available ? pushHistory(prev?.gpu ?? [], gpuValue) : prev?.gpu ?? [],
    networkDown: pushHistory(prev?.networkDown ?? [], snap.network.downloadBytesPerSec),
    networkUp: pushHistory(prev?.networkUp ?? [], snap.network.uploadBytesPerSec),
    battery: snap.battery.available
      ? pushHistory(prev?.battery ?? [], batteryValue)
      : prev?.battery ?? [],
  }
}

export function useCopilotTelemetry() {
  const historyRef = useRef<TelemetryHistory | null>(null)
  const [history, setHistory] = useState<TelemetryHistory | null>(null)

  const query = useQuery({
    queryKey: ['copilot-monitoring-panel'],
    queryFn: () => fetchMonitoringSnapshot(false),
    refetchInterval: POLL_MS,
    staleTime: 2000,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!query.data) return
    const next = buildHistory(historyRef.current, query.data)
    historyRef.current = next
    setHistory(next)
  }, [query.data])

  return {
    snapshot: query.data,
    history,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    pollIntervalMs: POLL_MS,
  }
}
