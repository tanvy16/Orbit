import type { DesktopActionPlan, DesktopActionResult } from '@shared/types'

import { apiFetch } from './http'

function hasDesktopBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.orbit?.executeDesktopAction === 'function'
}

export async function runDesktopAction(plan: DesktopActionPlan): Promise<DesktopActionResult> {
  if (!hasDesktopBridge()) {
    return {
      ok: false,
      message: 'Desktop actions require the Orbit desktop app.',
    }
  }
  return window.orbit.executeDesktopAction(plan)
}

export async function processClipboard(
  operation: string,
  content: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await apiFetch<{ reply: string }>('/api/v1/copilot/clipboard', {
    method: 'POST',
    body: JSON.stringify({ operation, content }),
    signal,
    timeoutMs: 90_000,
  })
  return response.reply
}

export function formatActionResult(result: DesktopActionResult): string {
  return result.ok ? `✓ ${result.message}` : `✗ ${result.message}`
}
