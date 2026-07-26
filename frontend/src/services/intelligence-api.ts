import type {
  IntelligenceHistoryResponse,
  IntelligenceOverview,
  ProcessIntelligenceDetail,
} from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchIntelligenceOverview() {
  return apiFetch<IntelligenceOverview>('/api/v1/intelligence/overview', { timeoutMs: 15_000 })
}

export function fetchCpuIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/cpu', { timeoutMs: 15_000 })
}

export function fetchMemoryIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/memory', { timeoutMs: 15_000 })
}

export function fetchStorageIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/storage', { timeoutMs: 20_000 })
}

export function fetchNetworkIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/network', { timeoutMs: 15_000 })
}

export function fetchKernelIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/kernel', { timeoutMs: 10_000 })
}

export function fetchGpuIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/gpu', { timeoutMs: 10_000 })
}

export function fetchBatteryIntelligence() {
  return apiFetch<Record<string, unknown>>('/api/v1/intelligence/battery', { timeoutMs: 10_000 })
}

export function fetchProcessIntelligence(pid: number) {
  return apiFetch<ProcessIntelligenceDetail>(`/api/v1/intelligence/process/${pid}`, { timeoutMs: 10_000 })
}

export function fetchIntelligenceHistory(metric: string, hours: number) {
  return apiFetch<IntelligenceHistoryResponse>(
    `/api/v1/intelligence/history?metric=${metric}&hours=${hours}`,
    { timeoutMs: 10_000 },
  )
}

export function fetchIntelligenceTimeline(limit = 40, search?: string) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (search?.trim()) params.set('search', search.trim())
  return apiFetch<{ items: IntelligenceOverview['timeline']; count: number }>(
    `/api/v1/intelligence/timeline?${params.toString()}`,
    { timeoutMs: 8_000 },
  )
}
