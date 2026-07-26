import { apiFetch } from '@/services/http'

export interface EventLogItem {
  id: number
  category: string
  action: string
  status: string
  userCommand?: string
  intent?: string
  model?: string
  route?: string
  durationMs?: number
  verified?: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

export interface DiagnosticItem {
  type?: string
  message?: string
  model?: string
  route?: string
  directAnswer?: boolean
  profile?: Record<string, number>
  recordedAt?: number
}

export function fetchEventLog(params?: {
  limit?: number
  category?: string
  status?: string
  search?: string
}) {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.category) query.set('category', params.category)
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiFetch<{ items: EventLogItem[]; count: number }>(`/api/v1/observability/events${suffix}`)
}

export function fetchDiagnostics(limit = 50) {
  return apiFetch<{ items: DiagnosticItem[]; count: number }>(
    `/api/v1/observability/diagnostics?limit=${limit}`,
  )
}

export function fetchMetricHistory(metric: string, hours = 1) {
  return apiFetch<{ metric: string; hours: number; points: { value: number; recordedAt: string }[] }>(
    `/api/v1/observability/metrics/history?metric=${metric}&hours=${hours}`,
  )
}
