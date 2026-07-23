import type { ApiHealthResponse } from '@shared/types'

import { appConfig } from '@/config/app'

export async function fetchHealth(): Promise<ApiHealthResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/health`)
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`)
  }
  return response.json() as Promise<ApiHealthResponse>
}

export async function pingElectron(): Promise<{ ok: true; timestamp: number; source: 'main' }> {
  if (!window.orbit) {
    throw new Error('Electron bridge unavailable — run inside Orbit desktop app')
  }
  return window.orbit.ping()
}
