import type { OllamaModelsResponse } from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchOllamaModels(baseUrl?: string) {
  const query = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : ''
  return apiFetch<OllamaModelsResponse>(`/api/v1/ollama/models${query}`, {
    timeoutMs: 12_000,
  })
}
