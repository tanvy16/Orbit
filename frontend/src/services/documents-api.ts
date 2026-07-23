import type {
  DocumentStatsDto,
  OrbitAppSettings,
  PaginatedDocumentsResponse,
  WatchedFolderDto,
} from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchDocumentStats() {
  return apiFetch<DocumentStatsDto>('/api/v1/documents/stats')
}

export function fetchDocuments(params: {
  page: number
  pageSize: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  extension?: string
  folderId?: number
  search?: string
  status?: string
}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  query.set('sortBy', params.sortBy)
  query.set('sortDir', params.sortDir)
  if (params.extension) query.set('extension', params.extension)
  if (params.folderId) query.set('folderId', String(params.folderId))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  return apiFetch<PaginatedDocumentsResponse>(`/api/v1/documents?${query.toString()}`)
}

export function fetchFolders() {
  return apiFetch<WatchedFolderDto[]>('/api/v1/folders')
}

export function createFolder(path: string, label?: string) {
  return apiFetch<WatchedFolderDto>('/api/v1/folders', {
    method: 'POST',
    body: JSON.stringify({ path, label, enabled: true }),
  })
}

export function deleteFolder(folderId: number) {
  return apiFetch<{ ok: boolean }>(`/api/v1/folders/${folderId}`, { method: 'DELETE' })
}

export function fetchSettings() {
  return apiFetch<OrbitAppSettings>('/api/v1/settings')
}

export function updateSettings(patch: Partial<OrbitAppSettings>) {
  return apiFetch<OrbitAppSettings>('/api/v1/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function runMaintenance(payload: { pruneRemoved: boolean; recomputeDuplicateFlags: boolean }) {
  return apiFetch<{ prunedRemovedRecords: number; duplicatesRecomputed: boolean }>(
    '/api/v1/settings/maintenance',
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export function requireElectron() {
  if (!window.orbit) {
    throw new Error('Desktop integration requires the Orbit Electron app')
  }
  return window.orbit
}

export async function pickAndRegisterFolders() {
  const orbit = requireElectron()
  const paths = await orbit.selectFolders()
  const created = []
  for (const path of paths) {
    created.push(await createFolder(path))
  }
  if (created.length > 0) {
    await orbit.resyncWatcher()
    for (const folder of created) {
      await orbit.startFolderScan({ folderId: folder.id, folderPath: folder.path })
    }
  }
  return created
}

export async function resyncAndScanFolder(folder: WatchedFolderDto) {
  const orbit = requireElectron()
  await orbit.resyncWatcher()
  return orbit.startFolderScan({ folderId: folder.id, folderPath: folder.path })
}
