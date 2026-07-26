import { execFile, spawn } from 'node:child_process'
import { access, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ResolveMethod =
  | 'app-paths-registry'
  | 'where'
  | 'get-command'
  | 'start-menu'
  | 'known-path'
  | 'alias'

export interface ResolvedApplication {
  displayName: string
  executablePath: string
  launchArgs: string[]
  resolvedVia: ResolveMethod
}

export interface LaunchApplicationResult {
  ok: boolean
  message: string
  resolvedVia?: ResolveMethod
  executablePath?: string
  reason?: string
  verified?: boolean
  details?: string
  durationMs?: number
}

/** Search terms keyed by normalized app id — used only as resolver hints, not launch commands. */
const ALIAS_SEARCH_TERMS: Record<string, { displayName: string; candidates: string[] }> = {
  chrome: {
    displayName: 'Google Chrome',
    candidates: ['chrome.exe', 'google chrome.exe', 'Google Chrome'],
  },
  vscode: {
    displayName: 'VS Code',
    candidates: ['Code.exe', 'code.cmd', 'Microsoft VS Code'],
  },
  code: {
    displayName: 'VS Code',
    candidates: ['Code.exe', 'code.cmd', 'Microsoft VS Code'],
  },
  cursor: {
    displayName: 'Cursor',
    candidates: ['Cursor.exe', 'cursor.exe'],
  },
  spotify: {
    displayName: 'Spotify',
    candidates: ['Spotify.exe', 'spotify.exe'],
  },
  discord: {
    displayName: 'Discord',
    candidates: ['Discord.exe', 'Update.exe'],
  },
  notepad: {
    displayName: 'Notepad',
    candidates: ['notepad.exe'],
  },
  explorer: {
    displayName: 'File Explorer',
    candidates: ['explorer.exe'],
  },
}

function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .replace(/^launch\s+/i, '')
    .replace(/\s+(app|application)$/i, '')
    .trim()
    .toLowerCase()
}

function buildCandidateNames(query: string): string[] {
  const normalized = normalizeQuery(query)
  const alias = ALIAS_SEARCH_TERMS[normalized]
  const names = new Set<string>()

  names.add(normalized)
  if (!normalized.endsWith('.exe')) {
    names.add(`${normalized}.exe`)
  }

  if (alias) {
    for (const candidate of alias.candidates) {
      names.add(candidate.toLowerCase())
      if (!candidate.toLowerCase().endsWith('.exe') && !candidate.includes(' ')) {
        names.add(`${candidate.toLowerCase()}.exe`)
      }
    }
  }

  // Common variants: "vs code" -> code.exe, "google chrome" -> chrome.exe
  if (normalized.includes('vs code') || normalized === 'visual studio code') {
    names.add('code.exe')
  }
  if (normalized.includes('google chrome')) {
    names.add('chrome.exe')
  }
  if (normalized.includes('file explorer') || normalized === 'files') {
    names.add('explorer.exe')
  }

  return [...names]
}

function displayNameFor(query: string): string {
  const normalized = normalizeQuery(query)
  const alias = ALIAS_SEARCH_TERMS[normalized]
  if (alias) return alias.displayName
  return query.trim().replace(/\b\w/g, (char) => char.toUpperCase())
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function queryRegistryAppPath(exeName: string): Promise<string | null> {
  const keys = [
    `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
    `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
    `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
  ]

  for (const key of keys) {
    try {
      const { stdout } = await execFileAsync('reg', ['query', key, '/ve'], {
        windowsHide: true,
        timeout: 5000,
      })
      const match = stdout.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)\r?$/m)
      if (match?.[1]) {
        const value = match[1].trim().replace(/^"(.*)"$/, '$1')
        if (value && (await fileExists(value))) {
          return value
        }
      }
    } catch {
      /* try next key */
    }
  }
  return null
}

async function queryWhere(command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('where.exe', [command], {
      windowsHide: true,
      timeout: 8000,
    })
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (first && (await fileExists(first))) {
      return first
    }
  } catch {
    /* not on PATH */
  }
  return null
}

async function queryGetCommand(command: string): Promise<string | null> {
  const script = [
    '$ErrorActionPreference = "Stop"',
    `$item = Get-Command ${JSON.stringify(command)} -ErrorAction SilentlyContinue | Select-Object -First 1`,
    'if ($null -eq $item) { exit 2 }',
    'if ($item.Source) { Write-Output $item.Source; exit 0 }',
    'if ($item.Definition) { Write-Output $item.Definition; exit 0 }',
    'exit 2',
  ].join('; ')

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 10000 },
    )
    const resolved = stdout.trim().split(/\r?\n/).find(Boolean)
    if (resolved && (await fileExists(resolved))) {
      return resolved
    }
  } catch {
    /* not found */
  }
  return null
}

async function scanStartMenu(exeName: string, displayHint?: string): Promise<string | null> {
  const roots = [
    join(process.env['ProgramData'] || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    join(process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming'), 'Microsoft\\Windows\\Start Menu\\Programs'),
  ]

  const needle = exeName.toLowerCase().replace(/\.exe$/i, '')
  const hint = displayHint?.toLowerCase()

  async function walk(dir: string, depth = 0): Promise<string | null> {
    if (depth > 4) return null
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return null
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      let entryStat
      try {
        entryStat = await stat(fullPath)
      } catch {
        continue
      }

      if (entryStat.isDirectory()) {
        const nested = await walk(fullPath, depth + 1)
        if (nested) return nested
        continue
      }

      const lower = entry.toLowerCase()
      if (!lower.endsWith('.exe') && !lower.endsWith('.lnk')) continue
      if (lower.endsWith('.exe') && lower.includes(needle)) {
        return fullPath
      }
      if (hint && lower.includes(hint.replace(/\s+/g, '').slice(0, 8))) {
        if (lower.endsWith('.exe')) return fullPath
      }
      if (lower.endsWith('.lnk') && (lower.includes(needle) || (hint && lower.includes(hint.split(' ')[0])))) {
        const target = await resolveShortcut(fullPath)
        if (target) return target
      }
    }
    return null
  }

  for (const root of roots) {
    const resolved = await walk(root)
    if (resolved) return resolved
  }
  return null
}

async function resolveShortcut(lnkPath: string): Promise<string | null> {
  const script = [
    '$shell = New-Object -ComObject WScript.Shell',
    `$shortcut = $shell.CreateShortcut(${JSON.stringify(lnkPath)})`,
    'Write-Output $shortcut.TargetPath',
  ].join('; ')
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 8000 },
    )
    const target = stdout.trim().split(/\r?\n/).find(Boolean)
    if (target && (await fileExists(target))) {
      return target
    }
  } catch {
    /* ignore */
  }
  return null
}

async function queryKnownInstallPaths(exeName: string): Promise<string | null> {
  const localAppData = process.env['LOCALAPPDATA'] || join(homedir(), 'AppData', 'Local')
  const appData = process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming')
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'

  const lower = exeName.toLowerCase()
  const candidates: string[] = []

  if (lower.includes('spotify')) {
    candidates.push(join(appData, 'Spotify', 'Spotify.exe'))
  }
  if (lower.includes('discord')) {
    candidates.push(join(localAppData, 'Discord', 'Update.exe'))
    candidates.push(join(localAppData, 'Discord', 'app-1.0.9003', 'Discord.exe'))
  }
  if (lower.includes('code.exe') || lower === 'code.exe') {
    candidates.push(join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'))
    candidates.push(join(programFiles, 'Microsoft VS Code', 'Code.exe'))
  }
  if (lower.includes('cursor')) {
    candidates.push(join(localAppData, 'Programs', 'cursor', 'Cursor.exe'))
  }
  if (lower.includes('chrome')) {
    candidates.push(join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    candidates.push(join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate
    }
  }
  return null
}

export async function resolveWindowsApplication(query: string): Promise<ResolvedApplication | null> {
  const candidates = buildCandidateNames(query)
  const displayName = displayNameFor(query)
  const tried = new Set<string>()

  for (const candidate of candidates) {
    if (tried.has(candidate)) continue
    tried.add(candidate)

    const exeName = candidate.endsWith('.exe') ? candidate : `${candidate}.exe`

    const registryPath = await queryRegistryAppPath(exeName)
    if (registryPath) {
      return {
        displayName,
        executablePath: registryPath,
        launchArgs: [],
        resolvedVia: 'app-paths-registry',
      }
    }

    const wherePath = await queryWhere(exeName)
    if (wherePath) {
      return {
        displayName,
        executablePath: wherePath,
        launchArgs: [],
        resolvedVia: 'where',
      }
    }

    const commandPath = await queryGetCommand(exeName)
    if (commandPath) {
      return {
        displayName,
        executablePath: commandPath,
        launchArgs: [],
        resolvedVia: 'get-command',
      }
    }

    const startMenuPath = await scanStartMenu(exeName, displayName)
    if (startMenuPath) {
      return {
        displayName,
        executablePath: startMenuPath,
        launchArgs: [],
        resolvedVia: 'start-menu',
      }
    }

    const knownPath = await queryKnownInstallPaths(exeName)
    if (knownPath) {
      return {
        displayName,
        executablePath: knownPath,
        launchArgs: [],
        resolvedVia: 'known-path',
      }
    }
  }

  // Discord Update.exe needs --processStart Discord.exe
  const normalized = normalizeQuery(query)
  if (normalized === 'discord') {
    const updateExe = await queryKnownInstallPaths('Update.exe')
    if (updateExe && updateExe.toLowerCase().includes('discord')) {
      return {
        displayName,
        executablePath: updateExe,
        launchArgs: ['--processStart', 'Discord.exe'],
        resolvedVia: 'known-path',
      }
    }
  }

  return null
}

function spawnDetached(executablePath: string, launchArgs: string[]): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    let settled = false
    const child = spawn(executablePath, launchArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    const finish = (result: { ok: boolean; reason?: string }) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    child.once('error', (error) => {
      finish({ ok: false, reason: error.message })
    })

    child.once('spawn', () => {
      child.unref()
      finish({ ok: true })
    })

    setTimeout(() => {
      if (!settled && child.pid) {
        child.unref()
        finish({ ok: true })
      }
    }, 750)
  })
}

async function verifyProcessRunning(imageName: string, timeoutMs = 4000): Promise<{ verified: boolean; details: string }> {
  const target = imageName.toLowerCase()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'])
      if (stdout.toLowerCase().includes(target)) {
        return { verified: true, details: `${imageName} process detected.` }
      }
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 450))
  }
  return {
    verified: false,
    details: `${imageName} process not detected within ${timeoutMs}ms.`,
  }
}

export async function launchWindowsApplication(
  query: string,
  displayNameHint?: string,
): Promise<LaunchApplicationResult> {
  const displayName = displayNameHint || displayNameFor(query)
  const resolved = await resolveWindowsApplication(query)
  const started = Date.now()

  if (!resolved) {
    return {
      ok: false,
      message: `Could not find “${displayName}” on this computer.`,
      reason:
        'No executable was found via App Paths registry, where.exe, Get-Command, Start Menu shortcuts, or known install locations.',
      verified: false,
      durationMs: Date.now() - started,
    }
  }

  const spawnResult = await spawnDetached(resolved.executablePath, resolved.launchArgs)
  if (!spawnResult.ok) {
    return {
      ok: false,
      message: `Found ${displayName} at ${resolved.executablePath} but failed to launch it.`,
      reason: spawnResult.reason,
      resolvedVia: resolved.resolvedVia,
      executablePath: resolved.executablePath,
      verified: false,
      durationMs: Date.now() - started,
    }
  }

  const imageName = basename(resolved.executablePath)
  const verification = await verifyProcessRunning(imageName)
  const durationMs = Date.now() - started

  return {
    ok: verification.verified,
    message: verification.verified
      ? `${displayName} launched successfully.`
      : `${displayName} was started but could not be verified.`,
    resolvedVia: resolved.resolvedVia,
    executablePath: resolved.executablePath,
    verified: verification.verified,
    details: verification.details,
    durationMs,
  }
}

export function processExecutableNameForApp(query: string): string {
  const normalized = normalizeQuery(query)
  const alias = ALIAS_SEARCH_TERMS[normalized]
  if (alias?.candidates[0]) {
    return basename(alias.candidates[0])
  }
  return normalized.endsWith('.exe') ? normalized : `${normalized}.exe`
}
