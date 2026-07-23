import chokidar, { type FSWatcher } from 'chokidar'
import { normalize } from 'node:path'

import { apiRequest } from './api-client'
import { emitWatcherChange } from './events'
import { indexingEngine } from './indexer'
import { taskManager } from './task-manager'

interface WatchedFolderRecord {
  id: number
  path: string
  enabled: boolean
}

export class FileWatcherService {
  private watchers = new Map<number, FSWatcher>()
  private debounceTimers = new Map<string, NodeJS.Timeout>()

  async resync(): Promise<void> {
    const folders = await apiRequest<WatchedFolderRecord[]>('/api/v1/folders')

    for (const [id, watcher] of this.watchers) {
      if (!folders.find((f) => f.id === id && f.enabled)) {
        await watcher.close()
        this.watchers.delete(id)
      }
    }

    for (const folder of folders) {
      if (folder.enabled) {
        await this.watchFolder(folder)
      }
    }
  }

  private async watchFolder(folder: WatchedFolderRecord): Promise<void> {
    if (this.watchers.has(folder.id)) return

    const settings = await apiRequest<{
      autoIndexOnChange: boolean
      ignoredDirectoryNames: string[]
      supportedExtensions: string[]
      maxFileSizeMb: number
      notifications: { watcherEvents: boolean }
    }>('/api/v1/settings')

    const ignored = settings.ignoredDirectoryNames

    const watcher = chokidar.watch(folder.path, {
      ignoreInitial: true,
      ignored: (path) => {
        const parts = normalize(path).split(/[/\\]/)
        return parts.some((part) => ignored.includes(part))
      },
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    })

    watcher.on('all', (event, path) => {
      emitWatcherChange({ path, type: event })
      if (!settings.autoIndexOnChange) return

      const key = `${folder.id}:${path}`
      const existing = this.debounceTimers.get(key)
      if (existing) clearTimeout(existing)

      this.debounceTimers.set(
        key,
        setTimeout(() => {
          void this.handleChange(folder.id, event, path, settings)
        }, 500),
      )
    })

    this.watchers.set(folder.id, watcher)
  }

  private async handleChange(
    folderId: number,
    event: string,
    path: string,
    settings: {
      ignoredDirectoryNames: string[]
      supportedExtensions: string[]
      maxFileSizeMb: number
      notifications: { watcherEvents: boolean }
    },
  ): Promise<void> {
    if (event === 'unlink' || event === 'unlinkDir') {
      await apiRequest('/api/v1/documents/batch', {
        method: 'POST',
        body: JSON.stringify({ files: [], removeMissingPaths: [path] }),
      })
      if (settings.notifications.watcherEvents) {
        await apiRequest('/api/v1/notifications', {
          method: 'POST',
          body: JSON.stringify({
            title: 'File removed',
            body: path,
            category: 'watcher',
            level: 'info',
          }),
        })
      }
      return
    }

    try {
      await indexingEngine.indexSingleFile(folderId, path, settings)
    } catch {
      // path may be directory or temp file
    }
  }

  async runStartupScans(): Promise<void> {
    const settings = await apiRequest<{ autoIndexOnStartup: boolean }>('/api/v1/settings')
    if (!settings.autoIndexOnStartup) return
    const folders = await apiRequest<WatchedFolderRecord[]>('/api/v1/folders')
    for (const folder of folders) {
      if (folder.enabled) {
        taskManager.scheduleFolderScan(folder.id, folder.path)
      }
    }
  }
}

export const fileWatcherService = new FileWatcherService()
