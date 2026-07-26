import type { DesktopActionPlan } from '@shared/types'

import { apiFetch } from './http'

export interface ExecuteActionResponse {
  ok: boolean
  result: {
    ok: boolean
    message: string
    executionTimeMs?: number
    data?: Record<string, unknown>
  }
  plan: DesktopActionPlan
}

export async function executeActionPlan(
  plan: DesktopActionPlan,
  options?: { userCommand?: string; force?: boolean },
): Promise<ExecuteActionResponse> {
  return apiFetch<ExecuteActionResponse>('/api/v1/actions/execute', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      userCommand: options?.userCommand ?? '',
      force: options?.force ?? false,
    }),
    timeoutMs: 60_000,
  })
}

export async function chooseActionFile(
  plan: DesktopActionPlan,
  path: string,
  fileName?: string,
  userCommand?: string,
): Promise<ExecuteActionResponse> {
  return apiFetch<ExecuteActionResponse>('/api/v1/actions/choose', {
    method: 'POST',
    body: JSON.stringify({ plan, path, fileName, userCommand: userCommand ?? '' }),
    timeoutMs: 60_000,
  })
}

export function formatExecutionMessage(result: ExecuteActionResponse['result']): string {
  return result.ok ? `✓ ${result.message}` : `✗ ${result.message}`
}
