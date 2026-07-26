import { useCallback, useEffect, useRef, useState } from 'react'

import type { CopilotMessageItem } from '@/components/copilot/CopilotMessageList'
import {
  chooseActionFile,
  executeActionPlan,
  formatExecutionMessage,
} from '@/services/actions-api'
import { sendCopilotMessage, streamCopilotMessage } from '@/services/copilot-api'
import { ApiError } from '@/services/http'
import type { CopilotHistoryMessage, DesktopActionCandidate, DesktopActionPlan } from '@shared/types'

const MAX_HISTORY = 8
const STREAM_FLUSH_MS = 16

const STATUS_LABELS: Record<string, string> = {
  preparing: 'Analyzing your request…',
  intent: 'Understanding intent…',
  context: 'Gathering context…',
  telemetry: 'Reading system telemetry…',
  rag: 'Searching documents…',
  generating: 'Generating response…',
}

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
  const [preparingLabel, setPreparingLabel] = useState('Analyzing your request…')
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
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

  const appendAssistantContent = useCallback((assistantId: string, suffix: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: `${m.content.trim()}\n\n${suffix}`.trim() } : m,
      ),
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

  const runConfirmedAction = useCallback(
    async (assistantId: string, plan: DesktopActionPlan, userCommand: string, force = false) => {
      setActionBusyId(assistantId)
      try {
        const response = force
          ? await executeActionPlan(plan, { userCommand, force: true })
          : await executeActionPlan(plan, { userCommand })
        appendAssistantContent(assistantId, formatExecutionMessage(response.result))
      } catch (actionError) {
        appendAssistantContent(assistantId, `✗ ${parseApiErrorMessage(actionError, 'Desktop action failed')}`)
      } finally {
        setActionBusyId(null)
      }
    },
    [appendAssistantContent],
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
      setPreparingLabel('Analyzing your request…')

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
          onStatus: (status) => {
            setPreparingLabel(STATUS_LABELS[status] ?? 'Preparing…')
          },
          onToken: (token) => {
            streamed = true
            setIsPreparing(false)
            pendingTokensRef.current += token
            scheduleTokenFlush(assistantId)
          },
          onDone: (data) => {
            flushPendingTokens(assistantId)
            setIsPreparing(false)
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m
                const streamedContent = (m.content + pendingTokensRef.current).trim()
                const finalContent = streamedContent || data.reply?.trim() || ''
                return { ...m, content: finalContent, meta: data, streaming: false }
              }),
            )
            pendingTokensRef.current = ''
          },
          onError: async (err) => {
            flushPendingTokens(assistantId)
            setIsPreparing(false)

            if (err.message === 'Request cancelled') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: m.content || pendingTokensRef.current || 'Response cancelled.',
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

  const confirmDesktopAction = useCallback(
    async (assistantId: string) => {
      const message = messages.find((item) => item.id === assistantId)
      const plan = message?.meta?.desktopActionPlan
      if (!plan) return
      const userMessage = [...messages]
        .slice(0, messages.findIndex((item) => item.id === assistantId))
        .reverse()
        .find((item) => item.role === 'user')
      await runConfirmedAction(assistantId, plan, userMessage?.content ?? '', true)
    },
    [messages, runConfirmedAction],
  )

  const chooseDesktopFile = useCallback(
    async (assistantId: string, candidate: DesktopActionCandidate) => {
      const message = messages.find((item) => item.id === assistantId)
      const plan = message?.meta?.desktopActionPlan
      if (!plan) return
      const userMessage = [...messages]
        .slice(0, messages.findIndex((item) => item.id === assistantId))
        .reverse()
        .find((item) => item.role === 'user')
      setActionBusyId(assistantId)
      try {
        const response = await chooseActionFile(
          plan,
          candidate.path,
          candidate.fileName ?? candidate.label,
          userMessage?.content ?? '',
        )
        appendAssistantContent(assistantId, formatExecutionMessage(response.result))
      } catch (actionError) {
        appendAssistantContent(assistantId, `✗ ${parseApiErrorMessage(actionError, 'Failed to open file')}`)
      } finally {
        setActionBusyId(null)
      }
    },
    [appendAssistantContent, messages],
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

  const regenerateLast = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser || isBusy) return
    setMessages((prev) => {
      const lastAssistantIndex = [...prev]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find((entry) => entry.message.role === 'assistant')?.index
      if (lastAssistantIndex == null) return prev
      return prev.slice(0, lastAssistantIndex)
    })
    setError(null)
    await sendMessage(lastUser.content)
  }, [isBusy, messages, sendMessage])

  const copyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      return true
    } catch {
      return false
    }
  }, [])

  return {
    messages,
    isBusy,
    isPreparing,
    preparingLabel,
    actionBusyId,
    error,
    sendMessage,
    cancel,
    retryLast,
    regenerateLast,
    copyMessage,
    confirmDesktopAction,
    chooseDesktopFile,
    setError,
  }
}
