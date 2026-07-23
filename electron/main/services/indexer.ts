import { randomUUID } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, normalize } from 'node:path'

import type { IndexProgressEvent } from '@shared/types'

import { apiRequest } from './api-client'
import { emitIndexComplete, emitIndexProgress } from './events'
import { hashFile, isSupportedExtension, shouldIgnoreDir } from './fs-service'

interface ScanSettings {
  ignoredDirectoryNames: string[]
  supportedExtensions: string[]
  maxFileSizeMb: number
}

export type IndexScanSettings = ScanSettings

interface ScanJob {
  taskId: string
  folderId: number
  folderPath: string
  cancelled: boolean
}

const BATCH_SIZE = 25

export class IndexingEngine {
  async collectFiles(
    root: string,
    settings: ScanSettings,
    onProgress?: (current: string, count: number) => void,
    isCancelled?: () => boolean,
  ): Promise<string[]> {
    const ignored = new Set(settings.ignoredDirectoryNames)
    const supported = new Set(settings.supportedExtensions.map((e) => e.toLowerCase()))
    const maxBytes = settings.maxFileSizeMb * 1024 * 1024
    const files: string[] = []

    const walk = async (dir: string): Promise<void> => {
      if (isCancelled?.()) return
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (isCancelled?.()) return
        const full = normalize(join(dir, entry.name))
        if (entry.isDirectory()) {
          if (shouldIgnoreDir(entry.name, ignored)) continue
          await walk(full)
          continue
        }
        if (!entry.isFile()) continue
        const ext = extname(entry.name).toLowerCase()
        if (!isSupportedExtension(ext, supported)) continue
        try {
          const info = await stat(full)
          if (info.size > maxBytes) continue
          files.push(full)
          onProgress?.(full, files.length)
        } catch {
          // skip
        }
      }
    }

    await walk(normalize(root))
    return files
  }

  async runScan(job: ScanJob, settings: ScanSettings): Promise<void> {
    const progressBase = {
      taskId: job.taskId,
      folderId: job.folderId,
      folderPath: job.folderPath,
      processed: 0,
      total: 0,
    }

    await apiRequest('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ id: job.taskId, taskType: 'folder_scan', status: 'running' }),
    })

    type Fingerprint = { sizeBytes: number; modifiedAt: string; contentHash: string | null }
    const fingerprints = await apiRequest<Record<string, Fingerprint>>(
      `/api/v1/documents/folders/${job.folderId}/fingerprints`,
    )

    const emit = (partial: Partial<IndexProgressEvent>): void => {
      emitIndexProgress({ ...progressBase, phase: 'scanning', ...partial })
    }

    emit({ phase: 'scanning', message: 'Discovering files…' })

    const files = await this.collectFiles(
      job.folderPath,
      settings,
      (current, count) => {
        emit({ currentPath: current, processed: 0, total: count, phase: 'scanning' })
      },
      () => job.cancelled,
    )

    if (job.cancelled) {
      await apiRequest(`/api/v1/tasks/${job.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled', progressPercent: 0 }),
      })
      return
    }

    const total = files.length
    emit({ total, processed: 0, phase: 'hashing', message: 'Hashing and uploading…' })

    let processed = 0
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (job.cancelled) break
      const chunk = files.slice(i, i + BATCH_SIZE)
      const payloadFiles = []
      for (const filePath of chunk) {
        if (job.cancelled) break
        try {
          const info = await stat(filePath)
          const existing = fingerprints[filePath]
          if (
            existing &&
            existing.sizeBytes === info.size &&
            existing.modifiedAt === info.mtime.toISOString() &&
            existing.contentHash
          ) {
            processed += 1
            continue
          }
          const contentHash = await hashFile(filePath)
          payloadFiles.push({
            path: filePath,
            fileName: basename(filePath),
            extension: extname(filePath).toLowerCase(),
            sizeBytes: info.size,
            modifiedAt: info.mtime.toISOString(),
            contentHash,
            indexStatus: 'indexed',
            watchedFolderId: job.folderId,
          })
        } catch (error) {
          payloadFiles.push({
            path: filePath,
            fileName: basename(filePath),
            extension: extname(filePath).toLowerCase(),
            sizeBytes: 0,
            modifiedAt: new Date().toISOString(),
            indexStatus: 'failed',
            watchedFolderId: job.folderId,
            errorMessage: error instanceof Error ? error.message : 'Index failed',
          })
        }
        processed += 1
        const percent = total === 0 ? 100 : Math.round((processed / total) * 100)
        emit({
          processed,
          total,
          currentPath: filePath,
          phase: 'uploading',
          message: `Indexed ${processed}/${total}`,
        })
        await apiRequest(`/api/v1/tasks/${job.taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'running',
            progressPercent: percent,
            currentPath: filePath,
            stats: { processed, total },
          }),
        })
      }

      if (payloadFiles.length > 0) {
        await apiRequest('/api/v1/documents/batch', {
          method: 'POST',
          body: JSON.stringify({ files: payloadFiles }),
        })
      }
    }

    if (job.cancelled) {
      await apiRequest(`/api/v1/tasks/${job.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })
      return
    }

    await apiRequest(`/api/v1/documents/folders/${job.folderId}/scanned`, { method: 'POST' })
    await apiRequest(`/api/v1/tasks/${job.taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        progressPercent: 100,
        stats: { processed, total },
      }),
    })

    await apiRequest('/api/v1/notifications', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Indexing complete',
        body: `Indexed ${processed} files in ${job.folderPath}`,
        category: 'indexing',
        level: 'success',
      }),
    })

    const completeEvent: IndexProgressEvent = {
      ...progressBase,
      processed,
      total,
      phase: 'complete',
      message: 'Scan complete',
    }
    emitIndexComplete(completeEvent)
  }

  async indexSingleFile(
    folderId: number,
    filePath: string,
    settings: ScanSettings,
  ): Promise<void> {
    const ext = extname(filePath).toLowerCase()
    const supported = new Set(settings.supportedExtensions.map((e) => e.toLowerCase()))
    if (!isSupportedExtension(ext, supported)) return

    const info = await stat(filePath)
    const maxBytes = settings.maxFileSizeMb * 1024 * 1024
    if (info.size > maxBytes) return

    let payload
    try {
      const contentHash = await hashFile(filePath)
      payload = {
        path: filePath,
        fileName: basename(filePath),
        extension: ext,
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
        contentHash,
        indexStatus: 'indexed',
        watchedFolderId: folderId,
      }
    } catch (error) {
      payload = {
        path: filePath,
        fileName: basename(filePath),
        extension: ext,
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
        indexStatus: 'failed',
        watchedFolderId: folderId,
        errorMessage: error instanceof Error ? error.message : 'Index failed',
      }
    }

    await apiRequest('/api/v1/documents/batch', {
      method: 'POST',
      body: JSON.stringify({ files: [payload] }),
    })
  }

  createJob(folderId: number, folderPath: string): ScanJob {
    return {
      taskId: randomUUID(),
      folderId,
      folderPath,
      cancelled: false,
    }
  }
}

export const indexingEngine = new IndexingEngine()
