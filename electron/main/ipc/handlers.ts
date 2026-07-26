import { dialog, ipcMain, shell } from 'electron'

import { IPC_CHANNELS, type AppInfo, type DesktopActionPlan, type PingResponse } from '@shared/types'

import { apiRequest } from '../services/api-client'
import { executeDesktopAction } from '../services/desktop-actions'
import { fileWatcherService } from '../services/watcher'
import { getEntryMetadata, listDirectory, readTextPreview } from '../services/fs-service'
import { pathGuard } from '../services/path-guard'
import { taskManager } from '../services/task-manager'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PING, (): PingResponse => {
    return { ok: true, timestamp: Date.now(), source: 'main' }
  })

  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, (): AppInfo => {
    return {
      name: 'Orbit',
      version: process.env['npm_package_version'] ?? '0.3.0',
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_PLATFORM, (): NodeJS.Platform => process.platform)

  ipcMain.handle(IPC_CHANNELS.FS_SELECT_FOLDERS, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections'],
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle(IPC_CHANNELS.FS_LIST_DIRECTORY, async (_event, targetPath: string) => {
    return listDirectory(targetPath)
  })

  ipcMain.handle(IPC_CHANNELS.FS_GET_ENTRY_METADATA, async (_event, targetPath: string) => {
    return getEntryMetadata(targetPath)
  })

  ipcMain.handle(IPC_CHANNELS.FS_READ_TEXT_PREVIEW, async (_event, targetPath: string) => {
    return readTextPreview(targetPath)
  })

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_PATH, async (_event, targetPath: string) => {
    const allowed = pathGuard.assertAllowed(targetPath)
    const result = await shell.openPath(allowed)
    return { ok: result === '', error: result || undefined }
  })

  ipcMain.handle(
    IPC_CHANNELS.INDEX_START_SCAN,
    async (_event, payload: { folderId: number; folderPath: string }) => {
      const taskId = await taskManager.enqueueFolderScan(payload.folderId, payload.folderPath)
      return { taskId }
    },
  )

  ipcMain.handle(IPC_CHANNELS.INDEX_CANCEL_TASK, async (_event, taskId: string) => {
    return { cancelled: taskManager.cancelTask(taskId) }
  })

  ipcMain.handle(IPC_CHANNELS.INDEX_GET_ACTIVE_TASKS, async () => {
    return taskManager.getActiveTasks()
  })

  ipcMain.handle(IPC_CHANNELS.WATCHER_RESYNC, async () => {
    await syncPathGuardRoots()
    await fileWatcherService.resync()
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_INVOKE, async () => {
    throw new Error('AI Copilot is reserved for Phase 4')
  })

  ipcMain.handle(IPC_CHANNELS.DESKTOP_ACTION_EXECUTE, async (_event, plan: DesktopActionPlan) => {
    return executeDesktopAction(plan)
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_RUN, async (_event, plan: DesktopActionPlan) => {
    return executeDesktopAction(plan)
  })
}

export async function syncPathGuardRoots(): Promise<void> {
  const folders = await apiRequest<Array<{ path: string }>>('/api/v1/folders')
  pathGuard.setRoots(folders.map((f) => f.path))
}

export async function bootstrapDesktopServices(): Promise<void> {
  await syncPathGuardRoots()
  await fileWatcherService.resync()
  await fileWatcherService.runStartupScans()
}
