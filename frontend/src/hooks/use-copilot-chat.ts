import { useCallback, useEffect, useRef, useState } from 'react'

import type { CopilotMessageItem } from '@/components/copilot/CopilotMessageList'
import { sendCopilotMessage, streamCopilotMessage } from '@/services/copilot-api'
import { ApiError } from '@/services/http'
import type { CopilotHistoryMessage } from '@shared/types'

const MAX_HISTORY = 8
/** Batch streamed tokens to reduce markdown re-parses (~30fps). */
const STREAM_FLUSH_MS = 32

function toHistory(items: CopilotMessageItem[]): CopilotHistoryMessage[] {
  return items
    .filter((m) => !m.streaming && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }))
}

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.message) as { detail?: string }
      if (parsed.detail) return parsed.detail
    } catch {
      /* plain text error body */
    }
    return error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function useCopilotChat() {
  const [messages, setMessages] = useState<CopilotMessageItem[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const pendingTokensRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  const flushPendingTokens = useCallback((assistantId: string) => {
    const chunk = pendingTokensRef.current
    if (!chunk) return
    pendingTokensRef.current = ''
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
    )
  }, [])

  const scheduleTokenFlush = useCallback(
    (assistantId: string) => {
      if (flushTimerRef.current != null) return
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null
        flushPendingTokens(assistantId)
      }, STREAM_FLUSH_MS)
    },
    [flushPendingTokens],
  )

  useEffect(() => {
    return () => {
      clearFlushTimer()
      abortRef.current?.abort()
    }
  }, [clearFlushTimer])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isBusy) return false

      setError(null)
      setIsBusy(true)
      setIsPreparing(true)

      const assistantId = `assistant-${Date.now()}`
      let historySnapshot: CopilotMessageItem[] = []

      setMessages((prev) => {
        historySnapshot = prev
        return [
          ...prev,
          { id: `user-${Date.now()}`, role: 'user', content: trimmed },
          { id: assistantId, role: 'assistant', content: '', streaming: true },
        ]
      })

      const history = toHistory(historySnapshot)
      const controller = new AbortController()
      abortRef.current = controller

      let streamed = false

      const finalizeAssistant = (update: Partial<CopilotMessageItem>) => {
        clearFlushTimer()
        pendingTokensRef.current = ''
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, ...update, streaming: false } : m,
          ),
        )
      }

      await streamCopilotMessage(
        trimmed,
        history,
        {
          onReady: () => setIsPreparing(false),
          onToken: (token) => {
            streamed = true
            setIsPreparing(false)
            pendingTokensRef.current += token
            scheduleTokenFlush(assistantId)
          },
          onDone: (data) => {
            flushPendingTokens(assistantId)
            setIsPreparing(false)
            finalizeAssistant({ content: data.reply, meta: data })
          },
          onError: async (err) => {
            flushPendingTokens(assistantId)
            setIsPreparing(false)

            if (err.message === 'Request cancelled') {
              flushPendingTokens(assistantId)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          pendingTokensRef.current ||
                          'Response cancelled.',
                        streaming: false,
                      }
                    : m,
                ),
              )
              pendingTokensRef.current = ''
              return
            }

            if (!streamed) {
              try {
                const data = await sendCopilotMessage(trimmed, history, controller.signal)
                finalizeAssistant({ content: data.reply, meta: data })
                return
              } catch (fallbackErr) {
                setError(parseApiErrorMessage(fallbackErr, err.message))
              }
            } else {
              setError(parseApiErrorMessage(err, 'Copilot stream failed'))
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
              )
              return
            }

            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          },
        },
        controller.signal,
      )

      abortRef.current = null
      setIsBusy(false)
      setIsPreparing(false)
      return true
    },
    [clearFlushTimer, flushPendingTokens, isBusy, scheduleTokenFlush],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const retryLast = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser || isBusy) return
    setError(null)
    await sendMessage(lastUser.content)
  }, [isBusy, messages, sendMessage])

  return {
    messages,
    isBusy,
    isPreparing,
    error,
    sendMessage,
    cancel,
    retryLast,
    setError,
  }
}
