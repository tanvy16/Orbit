import { normalize, resolve, sep } from 'node:path'

export class PathGuard {
  private roots: string[] = []

  setRoots(paths: string[]): void {
    this.roots = paths.map((p) => normalize(resolve(p)))
  }

  isUnderRoot(targetPath: string): boolean {
    const resolved = normalize(resolve(targetPath))
    return this.roots.some((root) => resolved === root || resolved.startsWith(`${root}${sep}`))
  }

  assertAllowed(targetPath: string): string {
    const resolved = normalize(resolve(targetPath))
    if (!this.isUnderRoot(resolved)) {
      throw new Error('Path is outside monitored folders')
    }
    return resolved
  }
}

export const pathGuard = new PathGuard()
