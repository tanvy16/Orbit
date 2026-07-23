import { indexingEngine } from './indexer'
import { apiRequest } from './api-client'
import { emitTaskUpdate } from './events'

interface ScanSettings {
  ignoredDirectoryNames: string[]
  supportedExtensions: string[]
  maxFileSizeMb: number
}

interface ActiveJob {
  job: ReturnType<typeof indexingEngine.createJob>
  promise: Promise<void>
}

export class TaskManager {
  private activeByFolder = new Map<number, ActiveJob>()
  private activeByTaskId = new Map<string, ActiveJob>()
  private queue: Array<{ folderId: number; folderPath: string }> = []
  private processing = false

  async enqueueFolderScan(folderId: number, folderPath: string): Promise<string> {
    if (this.activeByFolder.has(folderId)) {
      return this.activeByFolder.get(folderId)!.job.taskId
    }

    const job = indexingEngine.createJob(folderId, folderPath)
    const settings = await this.loadSettings()

    const promise = indexingEngine
      .runScan(job, settings)
      .catch(async (error) => {
        await apiRequest(`/api/v1/tasks/${job.taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Scan failed',
          }),
        })
        await apiRequest('/api/v1/notifications', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Indexing failed',
            body: error instanceof Error ? error.message : 'Scan failed',
            category: 'indexing',
            level: 'error',
          }),
        })
      })
      .finally(() => {
        this.activeByFolder.delete(folderId)
        this.activeByTaskId.delete(job.taskId)
        emitTaskUpdate({ taskId: job.taskId, status: 'finished' })
        void this.processQueue()
      })

    const active: ActiveJob = { job, promise }
    this.activeByFolder.set(folderId, active)
    this.activeByTaskId.set(job.taskId, active)

    return job.taskId
  }

  scheduleFolderScan(folderId: number, folderPath: string): void {
    if (this.activeByFolder.has(folderId)) return
    if (this.processing) {
      this.queue.push({ folderId, folderPath })
      return
    }
    this.processing = true
    void this.enqueueFolderScan(folderId, folderPath).finally(() => {
      this.processing = false
      void this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    const next = this.queue.shift()
    if (!next) return
    this.processing = true
    await this.enqueueFolderScan(next.folderId, next.folderPath)
    this.processing = false
    void this.processQueue()
  }

  cancelTask(taskId: string): boolean {
    const active = this.activeByTaskId.get(taskId)
    if (!active) return false
    active.job.cancelled = true
    return true
  }

  getActiveTasks(): Array<{ taskId: string; folderId: number; folderPath: string; status: string }> {
    return [...this.activeByTaskId.values()].map(({ job }) => ({
      taskId: job.taskId,
      folderId: job.folderId,
      folderPath: job.folderPath,
      status: job.cancelled ? 'cancelling' : 'running',
    }))
  }

  private async loadSettings(): Promise<ScanSettings> {
    const settings = await apiRequest<ScanSettings>('/api/v1/settings')
    return settings
  }
}

export const taskManager = new TaskManager()
