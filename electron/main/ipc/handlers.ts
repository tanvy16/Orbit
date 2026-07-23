import { ipcMain } from 'electron'
import { IPC_CHANNELS, type AppInfo, type PingResponse } from '@shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PING, (): PingResponse => {
    return {
      ok: true,
      timestamp: Date.now(),
      source: 'main',
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, (): AppInfo => {
    return {
      name: 'Orbit',
      version: process.env['npm_package_version'] ?? '0.1.0',
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_PLATFORM, (): NodeJS.Platform => {
    return process.platform
  })

  // Future phase stubs — return structured "not implemented" for safe IPC wiring tests
  ipcMain.handle(IPC_CHANNELS.FS_READ, async () => {
    throw new Error('Filesystem IPC is reserved for a future phase')
  })

  ipcMain.handle(IPC_CHANNELS.AI_INVOKE, async () => {
    throw new Error('AI IPC is reserved for a future phase')
  })
}
