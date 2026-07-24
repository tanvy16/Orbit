import { useQuery } from '@tanstack/react-query'
import { Bot, Send, Sparkles, Square } from 'lucide-react'
import { useRef, useState } from 'react'

import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import {
  fetchCopilotContext,
  sendCopilotMessage,
  streamCopilotMessage,
} from '@/services/copilot-api'
import {
  fetchMonitoringSnapshot,
  formatNetworkSpeed,
  formatSnapshotTime,
} from '@/services/monitoring-api'
import type { CopilotChatResponse, CopilotHistoryMessage, SystemMetricsSnapshot } from '@shared/types'
import { cn } from '@/utils/cn'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  meta?: CopilotChatResponse
  streaming?: boolean
}

function LiveSystemContextPanel({ snapshot }: { snapshot: SystemMetricsSnapshot | undefined }) {
  if (!snapshot) {
    return (
      <Card className="h-fit">
        <Spinner size="sm" label="Loading live telemetry…" />
      </Card>
    )
  }

  return (
    <Card className="h-fit">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">System context</h3>
        <span className="text-xs text-orbit-foreground-muted">
          Updated {formatSnapshotTime(snapshot.timestamp)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-orbit-foreground-muted">CPU</dt>
          <dd className="font-medium tabular-nums">{snapshot.cpu.usagePercent.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-orbit-foreground-muted">RAM</dt>
          <dd className="font-medium tabular-nums">{snapshot.memory.usagePercent.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-orbit-foreground-muted">Storage</dt>
          <dd className="font-medium tabular-nums">{snapshot.disk.usagePercent.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-orbit-foreground-muted">Battery</dt>
          <dd className="font-medium tabular-nums">
            {snapshot.battery.available && snapshot.battery.percent != null
              ? `${snapshot.battery.percent}%${snapshot.battery.charging ? ' ⚡' : ''}`
              : 'N/A'}
          </dd>
        </div>
        {snapshot.gpu.available && snapshot.gpu.usagePercent != null ? (
          <div>
            <dt className="text-xs text-orbit-foreground-muted">GPU</dt>
            <dd className="font-medium tabular-nums">{snapshot.gpu.usagePercent.toFixed(1)}%</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-orbit-foreground-muted">Processes</dt>
          <dd className="font-medium tabular-nums">{snapshot.processes.count}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-orbit-foreground-muted">Network</dt>
          <dd className="font-medium tabular-nums text-xs">{formatNetworkSpeed(snapshot)}</dd>
        </div>
      </dl>
    </Card>
  )
}

function RecommendationsPanel({
  recommendations,
}: {
  recommendations: CopilotChatResponse['recommendations'] | undefined
}) {
  if (!recommendations?.length) return null
  return (
    <Card>
      <h3 className="text-sm font-semibold">Recommendations</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {recommendations.map((rec, index) => (
          <li key={`${rec.title}-${index}`} className="rounded-lg border border-orbit-border/70 p-2">
            <div className="flex items-center gap-2">
              <Badge variant={rec.severity === 'high' ? 'accent' : 'muted'}>
                {rec.severity}
              </Badge>
              <span className="font-medium">{rec.title}</span>
            </div>
            <p className="mt-1 text-orbit-foreground-muted">{rec.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function CopilotPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const monitoringQuery = useQuery({
    queryKey: ['copilot-monitoring-panel'],
    queryFn: () => fetchMonitoringSnapshot(false),
    refetchInterval: 2500,
    staleTime: 2000,
  })

  const insightsQuery = useQuery({
    queryKey: ['copilot-insights'],
    queryFn: fetchCopilotContext,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const toHistory = (items: ChatMessage[]): CopilotHistoryMessage[] =>
    items
      .filter((m) => !m.streaming && m.content.trim())
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }))

  const send = async () => {
    const text = input.trim()
    if (!text || isBusy) return

    setInput('')
    setError(null)
    setIsBusy(true)
    setIsPreparing(true)

    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])

    const history = toHistory(messages)
    const controller = new AbortController()
    abortRef.current = controller

    let streamed = false
    await streamCopilotMessage(
      text,
      history,
      {
        onReady: () => {
          setIsPreparing(false)
        },
        onToken: (token) => {
          streamed = true
          setIsPreparing(false)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m,
            ),
          )
        },
        onDone: (data) => {
          setIsPreparing(false)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: data.reply, meta: data, streaming: false }
                : m,
            ),
          )
        },
        onError: async (err) => {
          setIsPreparing(false)
          if (err.message === 'Request cancelled') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content || 'Response cancelled.',
                      streaming: false,
                    }
                  : m,
              ),
            )
            return
          }
          if (!streamed) {
            try {
              const data = await sendCopilotMessage(text, history)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: data.reply, meta: data, streaming: false }
                    : m,
                ),
              )
              return
            } catch (fallbackErr) {
              setError(
                fallbackErr instanceof Error ? fallbackErr.message : err.message,
              )
            }
          } else {
            setError(err.message)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
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
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser || isBusy) return
    setInput(lastUser.content)
    setError(null)
  }

  const recommendations = insightsQuery.data?.recommendations

  return (
    <>
      <PageHeader
        title="AI Copilot"
        description="Natural language control with live system awareness and indexed document knowledge."
        actions={
          <div className="flex items-center gap-2">
            {insightsQuery.data?.modelUsed ? (
              <Badge variant="muted" className="hidden sm:inline-flex">
                {insightsQuery.data.modelUsed}
              </Badge>
            ) : null}
            <Badge variant="accent" className="gap-1">
              <Sparkles className="h-3 w-3" />
              System-aware
            </Badge>
          </div>
        }
      />

      <Card className="mb-4 border-orbit-accent/20 bg-orbit-accent/5">
        <p className="text-sm text-orbit-foreground">
          Orbit automatically chooses live telemetry, document search, or both based on your
          question — no mode switching required.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="flex min-h-[420px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-1">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <Bot className="mb-3 h-10 w-10 text-orbit-accent/80" />
                  <p className="text-sm font-medium">Ask about performance, memory, or your files</p>
                  <p className="mt-1 max-w-md text-sm text-orbit-foreground-muted">
                    Try: &quot;Why is my laptop slow?&quot; or &quot;Summarize my report&quot;
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'max-w-[92%] rounded-xl px-4 py-3',
                      msg.role === 'user'
                        ? 'ml-auto bg-orbit-accent text-orbit-accent-foreground text-sm leading-relaxed'
                        : 'mr-auto border border-orbit-border bg-orbit-muted/40',
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <CopilotMarkdown content={msg.content || (msg.streaming ? '…' : '')} />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.streaming && isPreparing && !msg.content ? (
                      <p className="mt-2 text-xs text-orbit-foreground-muted">Building context…</p>
                    ) : null}
                    {msg.streaming && !isPreparing && !msg.content ? (
                      <p className="mt-2 text-xs text-orbit-foreground-muted">Waiting for model…</p>
                    ) : null}
                    {msg.meta?.documentSources?.length ? (
                      <div className="mt-3 border-t border-orbit-border/60 pt-2 text-xs text-orbit-foreground-muted">
                        Sources:{' '}
                        {msg.meta.documentSources
                          .map((s) => s.fileName)
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {error ? (
              <div className="px-2 pb-2">
                <ErrorState compact title="Copilot unavailable" message={error} onRetry={retryLast} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 border-t border-orbit-border pt-4 sm:flex-row">
              <Input
                className="flex-1"
                placeholder="Ask Orbit about your system or documents…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send()
                }}
                disabled={isBusy}
              />
              {isBusy ? (
                <Button variant="secondary" onClick={cancel}>
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button onClick={() => void send()} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {monitoringQuery.isError ? (
            <ErrorState
              compact
              title="Telemetry unavailable"
              message={
                monitoringQuery.error instanceof Error
                  ? monitoringQuery.error.message
                  : 'Could not load system metrics'
              }
              onRetry={() => void monitoringQuery.refetch()}
            />
          ) : (
            <LiveSystemContextPanel snapshot={monitoringQuery.data} />
          )}
          {insightsQuery.data?.healthSummary ? (
            <Card>
              <h3 className="text-sm font-semibold">Health snapshot</h3>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {insightsQuery.data.healthSummary.score}/100
              </p>
              <p className="text-sm text-orbit-foreground-muted">
                Performance: {insightsQuery.data.healthSummary.performance}
              </p>
            </Card>
          ) : null}
          <RecommendationsPanel recommendations={recommendations} />
        </div>
      </div>
    </>
  )
}
