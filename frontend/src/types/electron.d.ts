import type {
  AppInfo,
  BackgroundTaskDto,
  DocumentStatsDto,
  IndexProgressEvent,
  IndexTaskSummary,
  NotificationDto,
  OrbitAppSettings,
  PaginatedDocumentsResponse,
  PingResponse,
  WatchedFolderDto,
  DesktopActionPlan,
  DesktopActionResult,
  FsDirectoryEntry,
  FsEntryMetadata,
} from '@shared/types'

export interface OrbitElectronAPI {
  ping: () => Promise<PingResponse>
  getAppInfo: () => Promise<AppInfo>
  getPlatform: () => Promise<NodeJS.Platform>
  selectFolders: () => Promise<string[]>
  listDirectory: (path: string) => Promise<FsDirectoryEntry[]>
  getEntryMetadata: (path: string) => Promise<FsEntryMetadata>
  readTextPreview: (path: string) => Promise<string>
  openPath: (path: string) => Promise<{ ok: boolean; error?: string }>
  startFolderScan: (payload: { folderId: number; folderPath: string }) => Promise<{ taskId: string }>
  cancelIndexTask: (taskId: string) => Promise<{ cancelled: boolean }>
  getActiveIndexTasks: () => Promise<IndexTaskSummary[]>
  resyncWatcher: () => Promise<{ ok: boolean }>
  executeDesktopAction: (plan: DesktopActionPlan) => Promise<DesktopActionResult>
  onIndexProgress: (listener: (event: IndexProgressEvent) => void) => () => void
  onIndexComplete: (listener: (event: IndexProgressEvent) => void) => () => void
  onWatcherChange: (listener: (event: { path: string; type: string }) => void) => () => void
  onTaskUpdate: (listener: (event: unknown) => void) => () => void
}

declare global {
  interface Window {
    orbit: OrbitElectronAPI
  }
}

export type {
  BackgroundTaskDto,
  DocumentStatsDto,
  NotificationDto,
  OrbitAppSettings,
  PaginatedDocumentsResponse,
  WatchedFolderDto,
}

export {}
