import type { SemanticSearchResultItem } from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchEmbeddingStatus() {
  return apiFetch<import('@shared/types').EmbeddingStatusDto>('/api/v1/embeddings/status')
}

export function syncEmbeddings() {
  return apiFetch<{ ok: boolean }>('/api/v1/embeddings/sync', { method: 'POST' })
}

export function rebuildEmbeddings() {
  return apiFetch<{ ok: boolean }>('/api/v1/embeddings/rebuild', { method: 'POST' })
}

export function semanticSearch(payload: {
  query: string
  page: number
  pageSize: number
  folderId?: number
  extension?: string
}) {
  return apiFetch<import('@shared/types').SemanticSearchResponse>('/api/v1/search/semantic', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchSearchStats() {
  return apiFetch<{ totalQueries: number }>('/api/v1/search/stats')
}

export async function openDocumentPath(path: string): Promise<void> {
  if (!window.orbit?.openPath) {
    throw new Error('Open document requires the Orbit desktop app')
  }
  const result = await window.orbit.openPath(path)
  if (!result.ok) {
    throw new Error(result.error ?? 'Unable to open document')
  }
}

export type { SemanticSearchResultItem }
