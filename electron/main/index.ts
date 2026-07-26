import { app, BrowserWindow, shell } from 'electron'
import { bootstrapDesktopServices, registerIpcHandlers } from './ipc/handlers'
import { setEventTarget } from './services/events'
import { startDesktopBridgeServer } from './services/desktop-bridge-server'
import { createMainWindow } from './window'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(async () => {
  registerIpcHandlers()
  startDesktopBridgeServer()
  mainWindow = createMainWindow()
  setEventTarget(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    void bootstrapDesktopServices()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      setEventTarget(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
