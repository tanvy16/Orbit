import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppInfo, type PingResponse } from '@shared/types'

export interface OrbitElectronAPI {
  ping: () => Promise<PingResponse>
  getAppInfo: () => Promise<AppInfo>
  getPlatform: () => Promise<NodeJS.Platform>
}

const orbitApi: OrbitElectronAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PLATFORM),
}

contextBridge.exposeInMainWorld('orbit', orbitApi)

declare global {
  interface Window {
    orbit: OrbitElectronAPI
  }
}
