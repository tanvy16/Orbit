import type { ApiHealthResponse } from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchHealth(): Promise<ApiHealthResponse> {
  return apiFetch<ApiHealthResponse>('/api/v1/health', { timeoutMs: 15_000 })
}

export async function pingElectron(): Promise<{ ok: true; timestamp: number; source: 'main' }> {
  if (!window.orbit) {
    throw new Error('Electron bridge unavailable — run inside Orbit desktop app')
  }
  return window.orbit.ping()
}
