import { appConfig } from '@/config/app'
import { ApiError } from '@/services/http'

export interface WorkflowStepPreview {
  stepNumber: number
  actionType: string
  target: string
  parameters: Record<string, unknown>
  label: string
}

export interface WorkflowPreview {
  name: string
  description: string
  steps: WorkflowStepPreview[]
}

export interface WorkflowDto extends WorkflowPreview {
  id: number
  createdAt: string | null
  updatedAt: string | null
  steps: Array<WorkflowStepPreview & { id?: number }>
}

export interface WorkflowRunResult {
  workflowId: number
  workflowName: string
  ok: boolean
  executionTimeMs: number
  steps: Array<{
    stepNumber: number
    label: string
    actionType: string
    ok: boolean
    message: string
  }>
}

export async function parseWorkflow(description: string): Promise<WorkflowPreview> {
  return apiFetch<WorkflowPreview>('/api/v1/automation/workflows/parse', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
}

export async function fetchWorkflows(): Promise<{ items: WorkflowDto[] }> {
  return apiFetch<{ items: WorkflowDto[] }>('/api/v1/automation/workflows')
}

export async function saveWorkflow(payload: WorkflowPreview): Promise<WorkflowDto> {
  return apiFetch<WorkflowDto>('/api/v1/automation/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteWorkflow(workflowId: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/v1/automation/workflows/${workflowId}`, {
    method: 'DELETE',
  })
}

export async function runWorkflow(workflowId: number): Promise<WorkflowRunResult> {
  return apiFetch<WorkflowRunResult>(`/api/v1/automation/workflows/${workflowId}/run`, {
    method: 'POST',
    timeoutMs: 120_000,
  })
}

export type WorkflowStreamEvent =
  | {
      type: 'workflow'
      status: 'queued'
      workflowId: number
      workflowName: string
      totalSteps: number
    }
  | {
      type: 'step'
      status: 'started' | 'running' | 'completed' | 'failed'
      stepNumber: number
      label: string
      actionType?: string
      ok?: boolean
      message?: string
      verified?: boolean
      durationMs?: number
    }
  | {
      type: 'complete'
      status: 'completed' | 'failed'
      payload: WorkflowRunResult
    }
  | { type: 'error'; message: string }

export async function streamWorkflowRun(
  workflowId: number,
  handlers: {
    onEvent: (event: WorkflowStreamEvent) => void
    onError: (error: Error) => void
  },
  signal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120_000)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  let sawComplete = false

  try {
    const response = await fetch(
      `${appConfig.apiBaseUrl}/api/v1/automation/workflows/${workflowId}/run/stream`,
      { method: 'POST', signal: controller.signal },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new ApiError(text || `Request failed (${response.status})`, response.status)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new ApiError('Streaming response unavailable', 500)
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const event = parseWorkflowSseLine(line)
        if (!event) continue
        if (event.type === 'complete') sawComplete = true
        handlers.onEvent(event)
      }
    }

    if (!sawComplete) {
      throw new ApiError('Automation stream ended before completion', 500)
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      handlers.onError(new ApiError(signal?.aborted ? 'Run cancelled' : 'Automation timed out', 408))
      return
    }
    handlers.onError(error instanceof Error ? error : new Error('Automation stream failed'))
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

function parseWorkflowSseLine(line: string): WorkflowStreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null
  try {
    return JSON.parse(trimmed.slice(6)) as WorkflowStreamEvent
  } catch {
    return null
  }
}

async function apiFetch<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 30_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method: init?.method,
      body: init?.body,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new ApiError(text || `Request failed (${response.status})`, response.status)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
