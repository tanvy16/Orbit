import { app, BrowserWindow, shell } from 'electron'
import { registerIpcHandlers } from './ipc/handlers'
import { createMainWindow } from './window'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  registerIpcHandlers()
  mainWindow = createMainWindow()

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
