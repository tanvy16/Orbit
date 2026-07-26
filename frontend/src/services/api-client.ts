import type { ApiHealthResponse } from '@shared/types'

import { apiFetch } from '@/services/http'

export interface StartupStatusResponse {
  backend: string
  database: string
  chroma: string
  semanticSearch: string
  aiModels: string
  aiDetail?: string
  desktopBridge: string
  automation: string
  errors?: {
    database?: string | null
    chroma?: string | null
    ai?: string | null
    desktopBridge?: string | null
  }
}

export function fetchHealth(): Promise<ApiHealthResponse> {
  return apiFetch<ApiHealthResponse>('/api/v1/health', { timeoutMs: 15_000 })
}

export function fetchStartupStatus(): Promise<StartupStatusResponse> {
  return apiFetch<StartupStatusResponse>('/api/v1/health/startup', { timeoutMs: 12_000 })
}

export async function pingElectron(): Promise<{ ok: true; timestamp: number; source: 'main' }> {
  if (!window.orbit) {
    throw new Error('Electron bridge unavailable — run inside Orbit desktop app')
  }
  return window.orbit.ping()
}
