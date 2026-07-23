/** IPC channel identifiers — keep in sync with electron/preload and main handlers */
export const IPC_CHANNELS = {
  PING: 'orbit:ping',
  GET_APP_INFO: 'orbit:get-app-info',
  GET_PLATFORM: 'orbit:get-platform',
  // Reserved for future phases
  FS_READ: 'orbit:fs:read',
  FS_WRITE: 'orbit:fs:write',
  AI_INVOKE: 'orbit:ai:invoke',
  MONITOR_SUBSCRIBE: 'orbit:monitor:subscribe',
  AUTOMATION_RUN: 'orbit:automation:run',
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
