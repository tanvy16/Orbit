import type { SystemMetricsSnapshot } from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchMonitoringSnapshot(includeProcesses = false) {
  const query = includeProcesses ? '?includeProcesses=true' : ''
  return apiFetch<SystemMetricsSnapshot>(`/api/v1/monitoring/snapshot${query}`, {
    timeoutMs: 8_000,
  })
}

function formatBytes(num: number): string {
  if (num < 1024 ** 2) return `${(num / 1024).toFixed(0)} KB/s`
  if (num < 1024 ** 3) return `${(num / 1024 ** 2).toFixed(1)} MB/s`
  return `${(num / 1024 ** 3).toFixed(1)} GB/s`
}

export function formatNetworkSpeed(snapshot: SystemMetricsSnapshot): string {
  return `↓ ${formatBytes(snapshot.network.downloadBytesPerSec)} ↑ ${formatBytes(snapshot.network.uploadBytesPerSec)}`
}

export function formatSnapshotTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}
