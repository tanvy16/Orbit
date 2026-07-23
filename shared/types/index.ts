/** IPC channel identifiers — keep in sync with electron/preload and main handlers */
export const IPC_CHANNELS = {
  PING: 'orbit:ping',
  GET_APP_INFO: 'orbit:get-app-info',
  GET_PLATFORM: 'orbit:get-platform',
  FS_SELECT_FOLDERS: 'orbit:fs:select-folders',
  FS_LIST_DIRECTORY: 'orbit:fs:list-directory',
  FS_GET_ENTRY_METADATA: 'orbit:fs:get-entry-metadata',
  FS_READ_TEXT_PREVIEW: 'orbit:fs:read-text-preview',
  INDEX_START_SCAN: 'orbit:index:start-scan',
  INDEX_CANCEL_TASK: 'orbit:index:cancel-task',
  INDEX_GET_ACTIVE_TASKS: 'orbit:index:get-active-tasks',
  WATCHER_RESYNC: 'orbit:watcher:resync',
  // Reserved — Phase 3+
  AI_INVOKE: 'orbit:ai:invoke',
  MONITOR_SUBSCRIBE: 'orbit:monitor:subscribe',
  AUTOMATION_RUN: 'orbit:automation:run',
  SEMANTIC_SEARCH: 'orbit:search:semantic',
  RAG_QUERY: 'orbit:rag:query',
} as const

/** Main → renderer push events (subscribe via preload) */
export const IPC_EVENTS = {
  INDEX_PROGRESS: 'orbit:event:index-progress',
  INDEX_COMPLETE: 'orbit:event:index-complete',
  TASK_UPDATE: 'orbit:event:task-update',
  WATCHER_CHANGE: 'orbit:event:watcher-change',
  NOTIFICATION: 'orbit:event:notification',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface AppInfo {
  name: string
  version: string
  electron: string
  node: string
  platform: NodeJS.Platform
}

export interface PingResponse {
  ok: true
  timestamp: number
  source: 'main'
}

export interface ApiHealthResponse {
  status: string
  service: string
  version: string
  database: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: string
  badge?: string
  phase?: number
}

export type IndexStatus = 'pending' | 'indexed' | 'failed' | 'skipped' | 'removed'

export interface FsDirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: string
}

export interface FsEntryMetadata {
  path: string
  name: string
  extension: string
  sizeBytes: number
  modifiedAt: string
  createdAt: string
  isDirectory: boolean
  isFile: boolean
}

export interface IndexProgressEvent {
  taskId: string
  folderId: number
  folderPath: string
  processed: number
  total: number
  currentPath?: string
  phase: 'scanning' | 'hashing' | 'uploading' | 'complete' | 'failed'
  message?: string
}

export interface IndexTaskSummary {
  taskId: string
  folderId: number
  folderPath: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
}

export interface OrbitAppSettings {
  ignoredDirectoryNames: string[]
  supportedExtensions: string[]
  autoIndexOnChange: boolean
  autoIndexOnStartup: boolean
  maxFileSizeMb: number
  notifications: {
    indexingComplete: boolean
    indexingErrors: boolean
    watcherEvents: boolean
  }
}

export const DEFAULT_SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.cpp',
  '.c',
  '.h',
  '.html',
  '.css',
  '.scss',
  '.yaml',
  '.yml',
  '.xml',
] as const

export const DEFAULT_IGNORED_DIRECTORY_NAMES = [
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'build',
  'out',
  'release',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
] as const

export const DEFAULT_APP_SETTINGS: OrbitAppSettings = {
  ignoredDirectoryNames: [...DEFAULT_IGNORED_DIRECTORY_NAMES],
  supportedExtensions: [...DEFAULT_SUPPORTED_EXTENSIONS],
  autoIndexOnChange: true,
  autoIndexOnStartup: true,
  maxFileSizeMb: 50,
  notifications: {
    indexingComplete: true,
    indexingErrors: true,
    watcherEvents: false,
  },
}

export interface WatchedFolderDto {
  id: number
  path: string
  label: string
  enabled: boolean
  lastScanAt: string | null
  indexedFileCount: number
  createdAt: string
}

export interface IndexedDocumentDto {
  id: number
  path: string
  fileName: string
  extension: string
  sizeBytes: number
  modifiedAt: string
  contentHash: string | null
  mimeType: string | null
  indexStatus: IndexStatus
  watchedFolderId: number | null
  watchedFolderPath: string | null
  isDuplicate: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DocumentStatsDto {
  totalIndexed: number
  totalPending: number
  totalFailed: number
  totalDuplicates: number
  byExtension: Record<string, number>
  watchedFolders: number
}

export interface PaginatedDocumentsResponse {
  items: IndexedDocumentDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface NotificationDto {
  id: number
  title: string
  body: string
  category: string
  level: 'info' | 'warning' | 'error' | 'success'
  read: boolean
  createdAt: string
}

export interface BackgroundTaskDto {
  id: string
  taskType: string
  status: string
  progressPercent: number
  currentPath: string | null
  stats: Record<string, unknown>
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

/** Extension points — implement in Phase 3+ */
export interface SemanticSearchQuery {
  query: string
  limit?: number
}

export interface AiCopilotInvokePayload {
  prompt: string
  contextDocumentIds?: number[]
}

export interface RagQueryPayload {
  query: string
  topK?: number
}
