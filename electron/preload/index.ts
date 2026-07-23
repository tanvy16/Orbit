import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS, IPC_EVENTS, type AppInfo, type IndexProgressEvent, type PingResponse } from '@shared/types'

export interface OrbitElectronAPI {
  ping: () => Promise<PingResponse>
  getAppInfo: () => Promise<AppInfo>
  getPlatform: () => Promise<NodeJS.Platform>
  selectFolders: () => Promise<string[]>
  listDirectory: (path: string) => Promise<import('@shared/types').FsDirectoryEntry[]>
  getEntryMetadata: (path: string) => Promise<import('@shared/types').FsEntryMetadata>
  readTextPreview: (path: string) => Promise<string>
  openPath: (path: string) => Promise<{ ok: boolean; error?: string }>
  startFolderScan: (payload: { folderId: number; folderPath: string }) => Promise<{ taskId: string }>
  cancelIndexTask: (taskId: string) => Promise<{ cancelled: boolean }>
  getActiveIndexTasks: () => Promise<import('@shared/types').IndexTaskSummary[]>
  resyncWatcher: () => Promise<{ ok: boolean }>
  onIndexProgress: (listener: (event: IndexProgressEvent) => void) => () => void
  onIndexComplete: (listener: (event: IndexProgressEvent) => void) => () => void
  onWatcherChange: (listener: (event: { path: string; type: string }) => void) => () => void
  onTaskUpdate: (listener: (event: unknown) => void) => () => void
}

function subscribe<T>(channel: string, listener: (event: T) => void): () => void {
  const handler = (_: Electron.IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const orbitApi: OrbitElectronAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PLATFORM),
  selectFolders: () => ipcRenderer.invoke(IPC_CHANNELS.FS_SELECT_FOLDERS),
  listDirectory: (path) => ipcRenderer.invoke(IPC_CHANNELS.FS_LIST_DIRECTORY, path),
  getEntryMetadata: (path) => ipcRenderer.invoke(IPC_CHANNELS.FS_GET_ENTRY_METADATA, path),
  readTextPreview: (path) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_TEXT_PREVIEW, path),
  openPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.FS_OPEN_PATH, path),
  startFolderScan: (payload) => ipcRenderer.invoke(IPC_CHANNELS.INDEX_START_SCAN, payload),
  cancelIndexTask: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.INDEX_CANCEL_TASK, taskId),
  getActiveIndexTasks: () => ipcRenderer.invoke(IPC_CHANNELS.INDEX_GET_ACTIVE_TASKS),
  resyncWatcher: () => ipcRenderer.invoke(IPC_CHANNELS.WATCHER_RESYNC),
  onIndexProgress: (listener) => subscribe(IPC_EVENTS.INDEX_PROGRESS, listener),
  onIndexComplete: (listener) => subscribe(IPC_EVENTS.INDEX_COMPLETE, listener),
  onWatcherChange: (listener) => subscribe(IPC_EVENTS.WATCHER_CHANGE, listener),
  onTaskUpdate: (listener) => subscribe(IPC_EVENTS.TASK_UPDATE, listener),
}

contextBridge.exposeInMainWorld('orbit', orbitApi)
