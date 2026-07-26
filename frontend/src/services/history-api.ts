import { apiFetch } from './http'

export interface ActionHistoryEntry {
  id: number
  actionId: string
  timestamp: string | null
  createdAt: string | null
  executedAt: string | null
  userCommand: string
  detectedIntent: string
  actionType: string
  parameters: Record<string, unknown>
  target?: string
  executionStatus: string
  executionTimeMs: number | null
  errorMessage: string | null
  source: string
}

export interface ActionHistoryListResponse {
  items: ActionHistoryEntry[]
  count: number
  limit: number
  offset: number
}

export interface RecordExecutionPayload {
  actionId: string
  executionStatus: 'success' | 'failed' | 'cancelled'
  executionTimeMs?: number
  errorMessage?: string
  parameters?: Record<string, unknown>
}

export async function fetchActionHistory(
  params?: {
    limit?: number
    offset?: number
    status?: string
    search?: string
  },
  signal?: AbortSignal,
): Promise<ActionHistoryListResponse> {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiFetch<ActionHistoryListResponse>(`/api/v1/history${suffix}`, { signal })
}

export async function fetchActionHistoryEntry(
  entryId: number,
  signal?: AbortSignal,
): Promise<ActionHistoryEntry> {
  return apiFetch<ActionHistoryEntry>(`/api/v1/history/${entryId}`, { signal })
}

export async function recordActionExecution(payload: RecordExecutionPayload): Promise<ActionHistoryEntry> {
  return apiFetch<ActionHistoryEntry>('/api/v1/history/record', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function clearActionHistory(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>('/api/v1/history', { method: 'DELETE' })
}
