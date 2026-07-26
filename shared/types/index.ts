/** IPC channel identifiers — keep in sync with electron/preload and main handlers */
export const IPC_CHANNELS = {
  PING: 'orbit:ping',
  GET_APP_INFO: 'orbit:get-app-info',
  GET_PLATFORM: 'orbit:get-platform',
  FS_SELECT_FOLDERS: 'orbit:fs:select-folders',
  FS_LIST_DIRECTORY: 'orbit:fs:list-directory',
  FS_GET_ENTRY_METADATA: 'orbit:fs:get-entry-metadata',
  FS_READ_TEXT_PREVIEW: 'orbit:fs:read-text-preview',
  FS_OPEN_PATH: 'orbit:fs:open-path',
  INDEX_START_SCAN: 'orbit:index:start-scan',
  INDEX_CANCEL_TASK: 'orbit:index:cancel-task',
  INDEX_GET_ACTIVE_TASKS: 'orbit:index:get-active-tasks',
  WATCHER_RESYNC: 'orbit:watcher:resync',
  // Reserved — Phase 3+
  AI_INVOKE: 'orbit:ai:invoke',
  MONITOR_SUBSCRIBE: 'orbit:monitor:subscribe',
  AUTOMATION_RUN: 'orbit:automation:run',
  DESKTOP_ACTION_EXECUTE: 'orbit:desktop:execute-action',
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
  chroma?: string
}

export interface EmbeddingStatusDto {
  documentsEmbedded: number
  documentsPending: number
  documentsProcessing: number
  documentsFailed: number
  documentsSkipped: number
  vectorChunks: number
  sqlChunkTotal: number
  chromaOk: boolean
  chromaError?: string | null
  chromaPath: string
  searchQueries: number
  /** @deprecated use vectorChunks */
  totalEmbeddings?: number
}

export interface SemanticSearchResultItem {
  documentId: number
  similarity: number
  snippet: string
  chunkId: string
  path: string
  fileName: string
  extension: string
  sizeBytes: number
  watchedFolderId: number | null
  embeddingStatus: string
}

export interface SemanticSearchResponse {
  items: SemanticSearchResultItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  query: string
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
  embeddingProvider: 'sentence-transformers' | 'ollama'
  embeddingModel: string
  ollamaBaseUrl: string
  chunkSize: number
  chunkOverlap: number
  autoEmbedOnIndex: boolean
  copilotProvider: 'ollama' | 'openai'
  copilotModel: string
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
  '.log',
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
  embeddingProvider: 'ollama',
  embeddingModel: 'nomic-embed-text',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  chunkSize: 800,
  chunkOverlap: 120,
  autoEmbedOnIndex: true,
  copilotProvider: 'ollama',
  copilotModel: 'qwen3:8b',
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

export interface SystemMetricsSnapshot {
  timestamp: number
  cpu: {
    usagePercent: number
    perCorePercent: number[]
    frequencyMhz: number | null
    coreCount: number
    loadHistory: number[]
  }
  memory: {
    totalBytes: number
    usedBytes: number
    availableBytes: number
    usagePercent: number
    topProcesses: { pid: number; name: string; memoryBytes: number }[]
  }
  disk: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    usagePercent: number
    partitions: {
      device: string
      mountpoint: string
      totalBytes: number
      usedBytes: number
      freeBytes: number
      usagePercent: number
    }[]
  }
  network: {
    uploadBytesPerSec: number
    downloadBytesPerSec: number
    bytesSentTotal: number
    bytesRecvTotal: number
  }
  battery: {
    available: boolean
    percent: number | null
    charging: boolean | null
    secsLeft: number | null
  }
  gpu: {
    available: boolean
    usagePercent: number | null
    name: string | null
    memoryUsedMb: number | null
    memoryTotalMb: number | null
  }
  processes: {
    count: number
    items: {
      pid: number
      name: string
      cpuPercent: number
      memoryBytes: number
      runtimeSeconds: number
    }[]
  }
}

export interface IntelligenceHealthFactor {
  score: number
  label: string
}

export interface IntelligenceOverview {
  timestamp: number
  health: CopilotHealthSummary & {
    factors: Record<string, IntelligenceHealthFactor>
    explanation: string
  }
  recommendations: CopilotRecommendation[]
  timeline: IntelligenceTimelineEvent[]
  resources: {
    cpu: { usagePercent: number; summary?: string }
    memory: { usagePercent: number; summary?: string }
    disk: { usagePercent: number; freeBytes: number }
    network: { downloadBytesPerSec: number; uploadBytesPerSec: number }
    gpu: SystemMetricsSnapshot['gpu']
    battery: SystemMetricsSnapshot['battery']
  }
  processes: SystemMetricsSnapshot['processes']
  collectionMs?: number
}

export interface IntelligenceTimelineEvent {
  id: string
  type: string
  message: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface ProcessClassification {
  label: string
  evidence: string
}

export interface ProcessIntelligenceDetail {
  pid: number
  name: string
  parentPid?: number
  executablePath?: string | null
  commandLine?: string | null
  startTime?: number
  runtimeSeconds: number
  threadCount: number
  handleCount?: number | null
  cpuPercent: number
  memoryBytes: number
  privateBytes?: number
  virtualBytes?: number
  digitalSignature?: { available: boolean; status: string; signer?: string | null }
  windowTitle?: string | null
  connectionCount?: number
  diskReadBytes?: number | null
  diskWriteBytes?: number | null
  connections?: Array<{
    localAddress?: string | null
    remoteAddress?: string | null
    status?: string
  }>
  status?: string
  username?: string | null
  classifications: ProcessClassification[]
  aiSummary: string
  memoryTrend?: Array<{ recordedAt: number; memoryBytes: number }>
}

export interface IntelligenceHistoryResponse {
  metric: string
  hours: number
  points: Array<{ metricKey?: string; value: number; recordedAt: string }>
  average: number
  current: number
  unusual: boolean
}

export interface CopilotSystemContext {
  cpuPercent?: number
  ramPercent?: number
  diskPercent?: number
  batteryPercent?: number | null
  batteryCharging?: boolean | null
  processCount?: number
  gpuPercent?: number | null
}

export interface CopilotHealthSummary {
  score: number
  performance: string
  detectedIssues: string[]
  recommendations: string[]
}

export interface OllamaModelDto {
  name: string
  sizeBytes: number
  modifiedAt: string | null
  digest?: string | null
}

export interface OllamaModelsResponse {
  ok: boolean
  baseUrl: string
  models: OllamaModelDto[]
  error: string | null
}

export interface CopilotRecommendation {
  severity: 'high' | 'medium' | 'low' | string
  title: string
  detail: string
  action: string
}

export interface CopilotHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Desktop automation action types — executed in Electron main process */
export type DesktopActionType =
  | 'launch_app'
  | 'open_folder'
  | 'open_file'
  | 'file_search'
  | 'file_create_folder'
  | 'file_create_text'
  | 'file_rename'
  | 'file_move'
  | 'file_copy'
  | 'file_delete'
  | 'close_process'
  | 'restart_process'
  | 'list_processes'
  | 'clipboard_intelligence'
  | 'system_shutdown'
  | 'system_restart'

export interface DesktopActionCandidate {
  label: string
  path: string
  fileName?: string
  documentId?: number
}

export interface DesktopActionPlan {
  id: string
  type: DesktopActionType
  params: Record<string, unknown>
  requiresConfirmation: boolean
  confirmationMessage?: string
  candidates?: DesktopActionCandidate[]
  status: 'pending' | 'awaiting_choice' | 'awaiting_confirmation'
  logMessage?: string
}

export interface DesktopActionResult {
  ok: boolean
  message: string
  status?: 'success' | 'failed'
  verified?: boolean
  durationMs?: number
  details?: string
  data?: Record<string, unknown>
}

export interface CopilotChatResponse {
  reply: string
  systemContext: CopilotSystemContext
  healthSummary: CopilotHealthSummary
  documentSearchUsed?: boolean
  documentSources: {
    documentId?: number
    fileName?: string
    path?: string
    similarity?: number
  }[]
  analysis: Record<string, unknown>
  recommendations?: CopilotRecommendation[]
  copilotProvider?: string
  modelUsed?: string
  directAnswer?: boolean
  desktopAction?: boolean
  desktopActionPlan?: DesktopActionPlan
  desktopActionResult?: DesktopActionResult
  profile?: Record<string, number>
}
