import { Bot, Copy, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'

import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { CopilotTypingIndicator } from '@/components/copilot/CopilotTypingIndicator'
import { DesktopActionPanel } from '@/components/copilot/DesktopActionPanel'
import { DocumentCitations } from '@/components/copilot/DocumentCitations'
import type { CopilotChatResponse, DesktopActionCandidate } from '@shared/types'
import { cn } from '@/utils/cn'

export interface CopilotMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  meta?: CopilotChatResponse
  streaming?: boolean
}

interface CopilotMessageListProps {
  messages: CopilotMessageItem[]
  isPreparing: boolean
  preparingLabel?: string
  streamingLabel?: string
  actionBusyId?: string | null
  onDesktopActionConfirm?: (messageId: string) => void
  onDesktopActionChoose?: (messageId: string, candidate: DesktopActionCandidate) => void
  onCopy?: (content: string) => void | Promise<boolean>
  onRegenerate?: () => void
  canRegenerate?: boolean
}

const NEAR_BOTTOM_PX = 120

export function CopilotMessageList({
  messages,
  isPreparing,
  preparingLabel = 'Analyzing your request…',
  streamingLabel = 'Generating response…',
  actionBusyId,
  onDesktopActionConfirm,
  onDesktopActionChoose,
  onCopy,
  onRegenerate,
  canRegenerate,
}: CopilotMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const lastScrollKeyRef = useRef('')

  const updateStickiness = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!stickToBottomRef.current) return
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  useEffect(() => {
    const tail = messages[messages.length - 1]
    const scrollKey = `${messages.length}:${tail?.content.length ?? 0}:${tail?.streaming ?? false}:${isPreparing}`
    if (scrollKey === lastScrollKeyRef.current) return
    lastScrollKeyRef.current = scrollKey

    const behavior: ScrollBehavior = messages.length <= 2 ? 'auto' : 'smooth'
    const frame = window.requestAnimationFrame(() => scrollToBottom(behavior))
    return () => window.cancelAnimationFrame(frame)
  }, [messages, isPreparing, scrollToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateStickiness, { passive: true })
    return () => el.removeEventListener('scroll', updateStickiness)
  }, [updateStickiness])

  return (
    <div
      ref={scrollRef}
      className="flex-1 space-y-5 overflow-y-auto scroll-smooth px-1 py-1"
    >
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center py-16 text-center">
          <Bot className="mb-3 h-10 w-10 text-orbit-accent/80" />
          <p className="text-sm font-medium">Ask about performance, memory, or your files</p>
          <p className="mt-1 max-w-md text-sm text-orbit-foreground-muted">
            Try: &quot;Why is my laptop slow?&quot; or &quot;What documents mention machine learning?&quot;
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant'
            const showPreparing = isAssistant && msg.streaming && isPreparing && !msg.content
            const showStreamingHint =
              isAssistant && msg.streaming && !isPreparing && !msg.content

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className={cn(
                  'max-w-[92%]',
                  msg.role === 'user' ? 'ml-auto' : 'mr-auto',
                )}
              >
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3.5 shadow-sm',
                    msg.role === 'user'
                      ? 'bg-orbit-accent text-orbit-accent-foreground'
                      : 'border border-orbit-border/80 bg-orbit-muted/35',
                  )}
                >
                  {isAssistant ? (
                    <>
                      {msg.content ? (
                        <CopilotMarkdown content={msg.content} streaming={msg.streaming} />
                      ) : null}
                      {showPreparing ? (
                        <CopilotTypingIndicator label={preparingLabel} className="py-1" />
                      ) : null}
                      {showStreamingHint ? (
                        <CopilotTypingIndicator label={streamingLabel} className="py-1" />
                      ) : null}
                      {!msg.streaming && msg.meta?.directAnswer ? (
                        <p className="mt-3 text-[11px] text-orbit-foreground-muted">
                          {msg.meta.desktopAction
                            ? 'Desktop action routed through Orbit automation'
                            : 'Answered instantly from Orbit telemetry & index data'}
                        </p>
                      ) : null}
                      {!msg.streaming && msg.meta?.desktopActionPlan ? (
                        <DesktopActionPanel
                          plan={msg.meta.desktopActionPlan}
                          busy={actionBusyId === msg.id}
                          onConfirm={() => onDesktopActionConfirm?.(msg.id)}
                          onChoose={(candidate) => onDesktopActionChoose?.(msg.id, candidate)}
                        />
                      ) : null}
                      {!msg.streaming && msg.meta?.documentSources?.length ? (
                        <DocumentCitations sources={msg.meta.documentSources} />
                      ) : null}
                      {!msg.streaming && msg.content ? (
                        <div className="mt-3 flex items-center gap-1 border-t border-orbit-border/50 pt-2">
                          <button
                            type="button"
                            onClick={() => void onCopy?.(msg.content)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-orbit-foreground-muted transition-colors hover:bg-orbit-muted/60 hover:text-orbit-foreground"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                          {canRegenerate && msg.id === messages[messages.length - 1]?.id ? (
                            <button
                              type="button"
                              onClick={() => onRegenerate?.()}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-orbit-foreground-muted transition-colors hover:bg-orbit-muted/60 hover:text-orbit-foreground"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Regenerate
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}
      <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
    </div>
  )
}
