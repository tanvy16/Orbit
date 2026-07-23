import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, normalize } from 'node:path'

import type { FsDirectoryEntry, FsEntryMetadata } from '@shared/types'

import { pathGuard } from './path-guard'

export async function hashFile(path: string): Promise<string> {
  const allowed = pathGuard.assertAllowed(path)
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(allowed)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
  })
}

export async function getEntryMetadata(targetPath: string): Promise<FsEntryMetadata> {
  const allowed = pathGuard.assertAllowed(targetPath)
  const info = await stat(allowed)
  return {
    path: allowed,
    name: basename(allowed),
    extension: extname(allowed).toLowerCase(),
    sizeBytes: info.size,
    modifiedAt: info.mtime.toISOString(),
    createdAt: info.birthtime.toISOString(),
    isDirectory: info.isDirectory(),
    isFile: info.isFile(),
  }
}

export async function listDirectory(targetPath: string): Promise<FsDirectoryEntry[]> {
  const allowed = pathGuard.assertAllowed(targetPath)
  const info = await stat(allowed)
  if (!info.isDirectory()) {
    throw new Error('Path is not a directory')
  }
  const entries = await readdir(allowed, { withFileTypes: true })
  const result: FsDirectoryEntry[] = []
  for (const entry of entries) {
    const full = normalize(join(allowed, entry.name))
    try {
      const meta = await stat(full)
      result.push({
        name: entry.name,
        path: full,
        isDirectory: entry.isDirectory(),
        sizeBytes: meta.size,
        modifiedAt: meta.mtime.toISOString(),
      })
    } catch {
      // skip inaccessible entries
    }
  }
  return result.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
}

export async function readTextPreview(targetPath: string, maxChars = 2000): Promise<string> {
  const allowed = pathGuard.assertAllowed(targetPath)
  const { readFile } = await import('node:fs/promises')
  const buf = await readFile(allowed)
  return buf.toString('utf8', 0, Math.min(buf.length, maxChars))
}

export function shouldIgnoreDir(name: string, ignored: Set<string>): boolean {
  return ignored.has(name)
}

export function isSupportedExtension(ext: string, supported: Set<string>): boolean {
  return supported.has(ext.toLowerCase())
}
