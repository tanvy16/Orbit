import type { CopilotChatResponse, CopilotHistoryMessage } from '@shared/types'

import { appConfig } from '@/config/app'
import { ApiError } from '@/services/http'

export function fetchCopilotContext() {
  return fetchJson<{
    healthSummary: CopilotChatResponse['healthSummary']
    recommendations?: CopilotChatResponse['recommendations']
    modelUsed?: string
    copilotProvider?: string
  }>('/api/v1/copilot/context', { timeoutMs: 10_000 })
}

export function sendCopilotMessage(message: string, history: CopilotHistoryMessage[] = []) {
  return fetchJson<CopilotChatResponse>('/api/v1/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
    timeoutMs: 120_000,
  })
}

export async function streamCopilotMessage(
  message: string,
  history: CopilotHistoryMessage[],
  handlers: {
    onReady?: () => void
    onToken: (token: string) => void
    onDone: (response: CopilotChatResponse) => void
    onError: (error: Error) => void
  },
  signal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120_000)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

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
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const payload = JSON.parse(trimmed.slice(6)) as {
          type: string
          content?: string
          detail?: string
          reply: string
          systemContext: CopilotChatResponse['systemContext']
          healthSummary: CopilotChatResponse['healthSummary']
          documentSearchUsed?: boolean
          documentSources?: CopilotChatResponse['documentSources']
          analysis?: CopilotChatResponse['analysis']
          recommendations?: CopilotChatResponse['recommendations']
          copilotProvider?: string
          modelUsed?: string
        }

        if (payload.type === 'status') {
          continue
        }
        if (payload.type === 'ready') {
          handlers.onReady?.()
        } else if (payload.type === 'token' && payload.content) {
          handlers.onToken(payload.content)
        } else if (payload.type === 'done') {
          handlers.onDone({
            reply: payload.reply,
            systemContext: payload.systemContext,
            healthSummary: payload.healthSummary,
            documentSearchUsed: payload.documentSearchUsed,
            documentSources: payload.documentSources ?? [],
            analysis: payload.analysis ?? {},
            recommendations: payload.recommendations,
            copilotProvider: payload.copilotProvider,
            modelUsed: payload.modelUsed,
          })
        } else if (payload.type === 'error') {
          throw new ApiError(payload.detail ?? 'Copilot stream failed', 500)
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      handlers.onError(new ApiError('Request cancelled', 499))
      return
    }
    handlers.onError(error instanceof Error ? error : new Error('Copilot stream failed'))
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onAbort)
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
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    init?.signal?.removeEventListener('abort', onExternalAbort)
  }
}
