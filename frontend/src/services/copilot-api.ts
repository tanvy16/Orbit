import type { CopilotChatResponse, DesktopActionResult, CopilotHistoryMessage } from '@shared/types'

import { appConfig } from '@/config/app'
import { ApiError } from '@/services/http'

const COPILOT_CONTEXT_TIMEOUT_MS = 10_000
const COPILOT_CHAT_TIMEOUT_MS = 120_000
const COPILOT_PREPARE_TIMEOUT_MS = 90_000

type StreamPayload = {
  type: string
  content?: string
  detail?: string
  reply?: string
  systemContext?: CopilotChatResponse['systemContext']
  healthSummary?: CopilotChatResponse['healthSummary']
  documentSearchUsed?: boolean
  documentSources?: CopilotChatResponse['documentSources']
  analysis?: CopilotChatResponse['analysis']
  recommendations?: CopilotChatResponse['recommendations']
  copilotProvider?: string
  modelUsed?: string
  directAnswer?: boolean
  desktopAction?: boolean
  desktopActionPlan?: CopilotChatResponse['desktopActionPlan']
  desktopActionResult?: DesktopActionResult
  profile?: Record<string, number>
}

export function fetchCopilotContext(signal?: AbortSignal) {
  return fetchJson<{
    healthSummary: CopilotChatResponse['healthSummary']
    recommendations?: CopilotChatResponse['recommendations']
    modelUsed?: string
    copilotProvider?: string
  }>('/api/v1/copilot/context', { timeoutMs: COPILOT_CONTEXT_TIMEOUT_MS, signal })
}

export function sendCopilotMessage(
  message: string,
  history: CopilotHistoryMessage[] = [],
  signal?: AbortSignal,
) {
  return fetchJson<CopilotChatResponse>('/api/v1/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
    timeoutMs: COPILOT_CHAT_TIMEOUT_MS,
    signal,
  })
}

export async function streamCopilotMessage(
  message: string,
  history: CopilotHistoryMessage[],
  handlers: {
    onReady?: () => void
    onStatus?: (status: string) => void
    onToken: (token: string) => void
    onDone: (response: CopilotChatResponse) => void
    onError: (error: Error) => void
  },
  signal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), COPILOT_CHAT_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  let sawDone = false

  try {
    const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/copilot/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    })

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
        const payload = parseSseDataLine(line)
        if (!payload) continue

        if (payload.type === 'status' && payload.content) {
          handlers.onStatus?.(payload.content)
          continue
        }

        if (payload.type === 'ready') {
          handlers.onReady?.()
          continue
        }

        if (payload.type === 'token' && payload.content) {
          handlers.onToken(payload.content)
          continue
        }

        if (payload.type === 'done') {
          sawDone = true
          handlers.onDone(buildChatResponse(payload))
          continue
        }

        if (payload.type === 'error') {
          throw new ApiError(payload.detail ?? 'Copilot stream failed', 500)
        }
      }
    }

    if (!sawDone) {
      throw new ApiError('Copilot stream ended before completion', 500)
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) {
        handlers.onError(new ApiError('Request cancelled', 499))
      } else {
        handlers.onError(
          new ApiError(`Request timed out after ${COPILOT_CHAT_TIMEOUT_MS}ms`, 408),
        )
      }
      return
    }
    handlers.onError(error instanceof Error ? error : new Error('Copilot stream failed'))
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

function parseSseDataLine(line: string): StreamPayload | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null
  try {
    return JSON.parse(trimmed.slice(6)) as StreamPayload
  } catch {
    return null
  }
}

function buildChatResponse(payload: StreamPayload): CopilotChatResponse {
  return {
    reply: payload.reply ?? '',
    systemContext: payload.systemContext ?? {},
    healthSummary: payload.healthSummary ?? {
      score: 0,
      performance: 'Unknown',
      detectedIssues: [],
      recommendations: [],
    },
    documentSearchUsed: payload.documentSearchUsed,
    documentSources: payload.documentSources ?? [],
    analysis: payload.analysis ?? {},
    recommendations: payload.recommendations,
    copilotProvider: payload.copilotProvider,
    modelUsed: payload.modelUsed,
    directAnswer: payload.directAnswer,
    desktopAction: payload.desktopAction,
    desktopActionPlan: payload.desktopActionPlan,
    desktopActionResult: payload.desktopActionResult,
    profile: payload.profile,
  }
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number; signal?: AbortSignal },
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 30_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const onExternalAbort = () => controller.abort()
  init?.signal?.addEventListener('abort', onExternalAbort)

  try {
    const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method: init?.method,
      body: init?.body,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new ApiError(text || `Request failed (${response.status})`, response.status)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (init?.signal?.aborted) {
        throw new ApiError('Request cancelled', 499)
      }
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    init?.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/** Exported for tests and diagnostics. */
export const copilotTimeouts = {
  contextMs: COPILOT_CONTEXT_TIMEOUT_MS,
  chatMs: COPILOT_CHAT_TIMEOUT_MS,
  prepareMs: COPILOT_PREPARE_TIMEOUT_MS,
}
