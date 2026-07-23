import type { SystemMetricsSnapshot } from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchMonitoringSnapshot() {
  return apiFetch<SystemMetricsSnapshot>('/api/v1/monitoring/snapshot', { timeoutMs: 15_000 })
}
