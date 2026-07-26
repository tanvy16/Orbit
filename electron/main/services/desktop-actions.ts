import { execFile, spawn } from 'node:child_process'
import {
  access,
  copyFile,
  constants,
  mkdir,
  rename as fsRename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { clipboard, shell } from 'electron'

import type { DesktopActionPlan, DesktopActionResult } from '@shared/types'

import { pathGuard } from './path-guard'
import { launchWindowsApplication, processExecutableNameForApp, resolveWindowsApplication } from './windows-app-resolver'

const execFileAsync = promisify(execFile)

const WIN_PROCESS_ALIASES: Record<string, string> = {
  chrome: 'chrome.exe',
  vscode: 'Code.exe',
  code: 'Code.exe',
  cursor: 'Cursor.exe',
  spotify: 'Spotify.exe',
  discord: 'Discord.exe',
  notepad: 'notepad.exe',
  explorer: 'explorer.exe',
}

const STANDARD_FOLDERS: Record<string, (home: string) => string> = {
  downloads: (home) => join(home, 'Downloads'),
  documents: (home) => join(home, 'Documents'),
  desktop: (home) => join(home, 'Desktop'),
  pictures: (home) => join(home, 'Pictures'),
  music: (home) => join(home, 'Music'),
  videos: (home) => join(home, 'Videos'),
  home: (home) => home,
}

function success(
  message: string,
  data?: Record<string, unknown>,
  extras?: Partial<DesktopActionResult>,
): DesktopActionResult {
  return { ok: true, message, status: 'success', ...extras, data }
}

function failure(message: string, extras?: Partial<DesktopActionResult>): DesktopActionResult {
  return { ok: false, message, status: 'failed', verified: false, ...extras }
}

function assertWritablePath(targetPath: string): string {
  try {
    return pathGuard.assertAllowed(targetPath)
  } catch {
    const home = homedir()
    const resolved = resolve(targetPath)
    const allowedRoots = Object.values(STANDARD_FOLDERS).map((fn) => resolve(fn(home)))
    if (allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}\\`) || resolved.startsWith(`${root}/`))) {
      return resolved
    }
    throw new Error('Path is outside allowed locations (monitored folders or standard user directories)')
  }
}

async function launchWindowsApp(appKey: string, displayName: string): Promise<DesktopActionResult> {
  const result = await launchWindowsApplication(appKey, displayName)
  if (!result.ok) {
    return failure(result.reason ? `${result.message} ${result.reason}` : result.message, {
      verified: result.verified ?? false,
      durationMs: result.durationMs,
      details: result.details,
      data: {
        executablePath: result.executablePath,
        resolvedVia: result.resolvedVia,
      },
    })
  }
  return success(
    result.message,
    {
      executablePath: result.executablePath,
      resolvedVia: result.resolvedVia,
    },
    {
      verified: result.verified ?? true,
      durationMs: result.durationMs,
      details: result.details,
    },
  )
}

async function launchUnixApp(appKey: string, displayName: string): Promise<DesktopActionResult> {
  const command = appKey === 'vscode' || appKey === 'code' ? 'code' : appKey
  const spawnResult = await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
    const child = spawn(command, [], { detached: true, stdio: 'ignore' })
    child.once('error', (error) => resolve({ ok: false, reason: error.message }))
    child.once('spawn', () => {
      child.unref()
      resolve({ ok: true })
    })
  })
  if (!spawnResult.ok) {
    return failure(`Could not launch ${displayName}: ${spawnResult.reason ?? 'unknown error'}`)
  }
  return success(`${displayName} launched successfully.`)
}

async function openFolder(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const key = String(params.key || params.folder || '').toLowerCase()
  const home = homedir()
  const resolver = STANDARD_FOLDERS[key]
  const folderPath = resolver ? resolver(home) : resolve(String(params.label || params.folder || home))
  const result = await shell.openPath(folderPath)
  if (result) {
    return failure(`Could not open folder: ${result}`)
  }
  return success(`${params.label || key || 'Folder'} opened successfully.`, { path: folderPath })
}

async function openFile(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const started = Date.now()
  const targetPath = String(params.path || '')
  if (!targetPath) {
    return failure('No file path was provided.', { verified: false })
  }
  let allowed: string
  try {
    allowed = assertWritablePath(targetPath)
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Path is not allowed.', { verified: false })
  }
  try {
    await access(allowed, constants.F_OK)
  } catch {
    return failure(`File not found: ${allowed}`, { verified: false, details: 'Path does not exist on disk.' })
  }
  const result = await shell.openPath(allowed)
  if (result) {
    return failure(`Could not open file: ${result}`, {
      verified: false,
      durationMs: Date.now() - started,
      details: 'File exists but the OS refused to open it.',
    })
  }
  return success(`${params.fileName || basename(allowed)} opened successfully.`, { path: allowed }, {
    verified: true,
    durationMs: Date.now() - started,
    details: 'File exists and open was dispatched to the default application.',
  })
}

async function closeProcess(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const processName = String(params.processName || params.target || '')
  const displayName = String(params.displayName || processName)
  if (process.platform === 'win32') {
    const resolved = await resolveWindowsApplication(processName)
    const image =
      WIN_PROCESS_ALIASES[processName.toLowerCase()] ||
      (resolved ? basename(resolved.executablePath) : processExecutableNameForApp(processName))
    await execFileAsync('taskkill', ['/IM', image, '/F'])
    return success(`${displayName} closed successfully.`)
  }
  await execFileAsync('pkill', ['-f', processName])
  return success(`${displayName} closed successfully.`)
}

async function restartProcess(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const closeResult = await closeProcess(params)
  if (!closeResult.ok) {
    return closeResult
  }
  const appKey = String(params.processName || params.target || '').toLowerCase()
  if (process.platform === 'win32') {
    return launchWindowsApp(appKey, String(params.displayName || appKey))
  }
  return launchUnixApp(appKey, String(params.displayName || appKey))
}

async function listProcesses(): Promise<DesktopActionResult> {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'])
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => `- ${line.split(',')[0]?.replaceAll('"', '') || line}`)
    return success(`**Running applications (sample):**\n${lines.join('\n')}`)
  }
  const { stdout } = await execFileAsync('ps', ['-ax', '-o', 'comm='])
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => `- ${line}`)
  return success(`**Running applications (sample):**\n${lines.join('\n')}`)
}

async function createFolder(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const name = String(params.name || 'New Folder')
  const parent = String(params.parentPath || join(homedir(), 'Desktop'))
  const target = assertWritablePath(join(parent, name))
  await mkdir(target, { recursive: true })
  return success(`Folder “${name}” created successfully.`, { path: target })
}

async function createTextFile(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const name = String(params.name || 'notes.txt')
  const parent = String(params.parentPath || join(homedir(), 'Desktop'))
  const target = assertWritablePath(join(parent, name.endsWith('.txt') ? name : `${name}.txt`))
  await writeFile(target, String(params.content || ''), 'utf8')
  return success(`Text file “${basename(target)}” created successfully.`, { path: target })
}

async function renamePath(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const source = assertWritablePath(String(params.sourcePath || params.source || ''))
  const destination = assertWritablePath(join(dirname(source), String(params.destination || '')))
  await fsRename(source, destination)
  return success(`Renamed to “${basename(destination)}” successfully.`, { path: destination })
}

async function movePath(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const source = assertWritablePath(String(params.sourcePath || params.source || ''))
  const destination = assertWritablePath(String(params.destinationPath || params.destination || ''))
  await fsRename(source, destination)
  return success(`Moved to “${destination}” successfully.`, { path: destination })
}

async function copyPath(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const source = assertWritablePath(String(params.sourcePath || params.source || ''))
  const destination = assertWritablePath(String(params.destinationPath || params.destination || ''))
  await copyFile(source, destination)
  return success(`Copied to “${destination}” successfully.`, { path: destination })
}

async function deletePath(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const target = assertWritablePath(String(params.targetPath || params.target || ''))
  await rm(target, { recursive: true, force: true })
  return success(`“${basename(target)}” deleted successfully.`, { path: target })
}

async function readClipboard(params: Record<string, unknown>): Promise<DesktopActionResult> {
  const text = clipboard.readText().trim()
  if (!text) {
    return failure('Your clipboard is empty or does not contain text.')
  }
  return success('Clipboard text captured.', { text, operation: params.operation })
}

async function systemShutdown(): Promise<DesktopActionResult> {
  if (process.platform === 'win32') {
    spawn('shutdown', ['/s', '/t', '0'], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('shutdown', ['-h', 'now'], { detached: true, stdio: 'ignore' }).unref()
  }
  return success('System shutdown initiated.')
}

async function systemRestart(): Promise<DesktopActionResult> {
  if (process.platform === 'win32') {
    spawn('shutdown', ['/r', '/t', '0'], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('shutdown', ['-r', 'now'], { detached: true, stdio: 'ignore' }).unref()
  }
  return success('System restart initiated.')
}

export async function executeDesktopAction(plan: DesktopActionPlan): Promise<DesktopActionResult> {
  const params = plan.params ?? {}

  switch (plan.type) {
    case 'launch_app': {
      const appKey = String(params.query || params.key || params.app || '')
      const displayName = String(params.displayName || appKey)
      return process.platform === 'win32'
        ? launchWindowsApp(appKey, displayName)
        : launchUnixApp(appKey, displayName)
    }
    case 'open_folder':
      return openFolder(params)
    case 'open_file':
      return openFile(params)
    case 'close_process':
      return closeProcess(params)
    case 'restart_process':
      return restartProcess(params)
    case 'list_processes':
      return listProcesses()
    case 'file_create_folder':
      return createFolder(params)
    case 'file_create_text':
      return createTextFile(params)
    case 'file_rename':
      return renamePath(params)
    case 'file_move':
      return movePath(params)
    case 'file_copy':
      return copyPath(params)
    case 'file_delete':
      return deletePath(params)
    case 'clipboard_intelligence':
      return readClipboard(params)
    case 'system_shutdown':
      return systemShutdown()
    case 'system_restart':
      return systemRestart()
    case 'file_search':
      return failure('File search results require a selection before opening.')
    default:
      return failure(`Unsupported desktop action: ${plan.type}`)
  }
}

export async function executeDesktopActionWithCandidate(
  plan: DesktopActionPlan,
  candidatePath: string,
): Promise<DesktopActionResult> {
  const nextPlan: DesktopActionPlan = {
    ...plan,
    type: 'open_file',
    status: 'pending',
    params: { ...plan.params, path: candidatePath, fileName: basename(candidatePath) },
  }
  return executeDesktopAction(nextPlan)
}
