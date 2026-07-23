import type { AppInfo, PingResponse } from '@shared/types'

export interface OrbitElectronAPI {
  ping: () => Promise<PingResponse>
  getAppInfo: () => Promise<AppInfo>
  getPlatform: () => Promise<NodeJS.Platform>
}

declare global {
  interface Window {
    orbit: OrbitElectronAPI
  }
}

export {}
