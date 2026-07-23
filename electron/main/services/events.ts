import type { BrowserWindow } from 'electron'

import { IPC_EVENTS, type IndexProgressEvent } from '@shared/types'

let mainWindow: BrowserWindow | null = null

export function setEventTarget(window: BrowserWindow | null): void {
  mainWindow = window
}

export function emitToRenderer<T>(channel: string, payload: T): void {
  mainWindow?.webContents.send(channel, payload)
}

export function emitIndexProgress(payload: IndexProgressEvent): void {
  emitToRenderer(IPC_EVENTS.INDEX_PROGRESS, payload)
}

export function emitIndexComplete(payload: IndexProgressEvent): void {
  emitToRenderer(IPC_EVENTS.INDEX_COMPLETE, payload)
}

export function emitTaskUpdate(payload: unknown): void {
  emitToRenderer(IPC_EVENTS.TASK_UPDATE, payload)
}

export function emitWatcherChange(payload: { path: string; type: string }): void {
  emitToRenderer(IPC_EVENTS.WATCHER_CHANGE, payload)
}

export function emitNotification(payload: unknown): void {
  emitToRenderer(IPC_EVENTS.NOTIFICATION, payload)
}
