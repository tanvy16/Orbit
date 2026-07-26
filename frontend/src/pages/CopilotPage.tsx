import { Send, Sparkles, Square } from 'lucide-react'
import { useState } from 'react'

import { CopilotMessageList } from '@/components/copilot/CopilotMessageList'
import { LiveTelemetryPanel } from '@/components/copilot/LiveTelemetryPanel'
import { RecommendationCards } from '@/components/copilot/RecommendationCards'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useCopilotChat } from '@/hooks/use-copilot-chat'
import { useCopilotTelemetry } from '@/hooks/use-copilot-telemetry'
import { fetchCopilotContext } from '@/services/copilot-api'
import { toast } from '@/stores/toast-store'
import { useQuery } from '@tanstack/react-query'

export function CopilotPage() {
  const [input, setInput] = useState('')
  const {
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
  } = useCopilotChat()
  const telemetry = useCopilotTelemetry()

  const insightsQuery = useQuery({
    queryKey: ['copilot-insights'],
    queryFn: ({ signal }) => fetchCopilotContext(signal),
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 2,
  })

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    await sendMessage(text)
  }

  const handleCopy = async (content: string) => {
    const ok = await copyMessage(content)
    toast({
      level: ok ? 'success' : 'error',
      title: ok ? 'Copied to clipboard' : 'Copy failed',
    })
    return ok
  }

  return (
    <>
      <PageHeader
        title="AI Copilot"
        description="Natural language control with live system awareness and indexed document knowledge."
        actions={
          <div className="flex items-center gap-2">
            {insightsQuery.data?.modelUsed ? (
              <Badge variant="muted" className="hidden normal-case tracking-normal sm:inline-flex">
                {insightsQuery.data.modelUsed}
              </Badge>
            ) : null}
            <Badge variant="accent" className="gap-1 normal-case tracking-normal">
              <Sparkles className="h-3 w-3" />
              System-aware
            </Badge>
          </div>
        }
      />

      <Card className="mb-4 border-orbit-accent/20 bg-orbit-accent/5" interactive={false}>
        <p className="text-sm text-orbit-foreground">
          Orbit automatically chooses live telemetry, document search, desktop actions, or reasoning
          based on your question — no mode switching required.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="flex min-h-[520px] flex-col">
            <CopilotMessageList
              messages={messages}
              isPreparing={isPreparing}
              preparingLabel={preparingLabel}
              actionBusyId={actionBusyId}
              onDesktopActionConfirm={confirmDesktopAction}
              onDesktopActionChoose={chooseDesktopFile}
              onCopy={handleCopy}
              onRegenerate={() => void regenerateLast()}
              canRegenerate={!isBusy}
            />

            {error ? (
              <div className="px-2 pb-2">
                <ErrorState
                  compact
                  title="Copilot unavailable"
                  message={error}
                  technicalDetail={error}
                  onRetry={() => void retryLast()}
                />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 border-t border-orbit-border pt-4 sm:flex-row sm:items-end">
              <Textarea
                className="min-h-[52px] flex-1 sm:min-h-[44px]"
                placeholder="Ask Orbit about your system or documents…"
                value={input}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                disabled={isBusy}
              />
              {isBusy ? (
                <Button variant="secondary" onClick={cancel}>
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button onClick={() => void handleSend()} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {telemetry.isError ? (
            <ErrorState
              compact
              title="Telemetry unavailable"
              message={
                telemetry.error instanceof Error
                  ? telemetry.error.message
                  : 'Could not load system metrics'
              }
              onRetry={() => void telemetry.refetch()}
            />
          ) : (
            <LiveTelemetryPanel
              snapshot={telemetry.snapshot}
              history={telemetry.history}
              isLoading={telemetry.isLoading}
              pollIntervalMs={telemetry.pollIntervalMs}
            />
          )}

          {insightsQuery.isLoading && !insightsQuery.data ? (
            <Card interactive={false}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-4 h-10 w-20" />
            </Card>
          ) : null}

          {insightsQuery.isError ? (
            <ErrorState
              compact
              title="Insights unavailable"
              message={
                insightsQuery.error instanceof Error
                  ? insightsQuery.error.message
                  : 'Could not load Copilot insights'
              }
              onRetry={() => void insightsQuery.refetch()}
            />
          ) : insightsQuery.data?.healthSummary ? (
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

          <RecommendationCards recommendations={insightsQuery.data?.recommendations} />
        </div>
      </div>
    </>
  )
}
