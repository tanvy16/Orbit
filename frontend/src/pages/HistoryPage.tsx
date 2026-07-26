import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Search, Trash2, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  clearActionHistory,
  fetchActionHistory,
  type ActionHistoryEntry,
} from '@/services/history-api'
import { cn } from '@/utils/cn'

function formatTime(timestamp: string | null): string {
  if (!timestamp) return 'Unknown time'
  return new Date(timestamp).toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function groupByDay(items: ActionHistoryEntry[]): Map<string, ActionHistoryEntry[]> {
  const groups = new Map<string, ActionHistoryEntry[]>()
  for (const item of items) {
    const day = item.timestamp
      ? new Date(item.timestamp).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : 'Unknown date'
    const bucket = groups.get(day) ?? []
    bucket.push(item)
    groups.set(day, bucket)
  }
  return groups
}

function statusIcon(status: string) {
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-orbit-danger" />
  return <Clock className="h-4 w-4 text-amber-500" />
}

function describeEntry(item: ActionHistoryEntry): string {
  const target = item.target || item.parameters?.target || item.actionType
  if (item.detectedIntent === 'launch_application') return `Opened ${target}`
  if (item.actionType === 'open_folder') return `Opened ${target}`
  if (item.actionType === 'open_file') return `Opened ${target}`
  if (item.actionType === 'close_process') return `Closed ${target}`
  if (item.source === 'automation') return item.userCommand
  return item.userCommand || `${item.actionType} ${target}`
}

export function HistoryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ActionHistoryEntry | null>(null)

  const historyQuery = useQuery({
    queryKey: ['action-history', search, status],
    queryFn: () =>
      fetchActionHistory({
        limit: 100,
        search: search.trim() || undefined,
        status: status || undefined,
      }),
    refetchInterval: 15_000,
  })

  const grouped = useMemo(
    () => groupByDay(historyQuery.data?.items ?? []),
    [historyQuery.data?.items],
  )

  const handleClear = async () => {
    await clearActionHistory()
    setSelected(null)
    await queryClient.invalidateQueries({ queryKey: ['action-history'] })
  }

  if (historyQuery.isLoading) {
    return (
      <>
        <PageHeader title="History" description="Timeline of Copilot commands and automation runs." />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-3 w-full" />
            </Card>
          ))}
        </div>
      </>
    )
  }

  if (historyQuery.isError) {
    return (
      <>
        <PageHeader title="History" description="Timeline of Copilot commands and automation runs." />
        <ErrorState
          message={
            historyQuery.error instanceof Error
              ? historyQuery.error.message
              : 'Failed to load history'
          }
          onRetry={() => void historyQuery.refetch()}
        />
      </>
    )
  }

  const items = historyQuery.data?.items ?? []

  return (
    <>
      <PageHeader
        title="History"
        description="Every Copilot command and saved automation run is recorded here."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void handleClear()} disabled={!items.length}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear history
          </Button>
        }
      />

      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-foreground-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search commands, intents, or targets…"
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </Select>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Run a Copilot desktop command or execute a saved automation to populate your timeline."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {[...grouped.entries()].map(([day, dayItems]) => (
              <section key={day}>
                <h2 className="mb-3 text-sm font-medium text-orbit-foreground-muted">{day}</h2>
                <ul className="space-y-3">
                  {dayItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className={cn(
                          'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                          selected?.id === item.id
                            ? 'border-orbit-accent/40 bg-orbit-accent/5'
                            : 'border-orbit-border bg-orbit-muted/20 hover:bg-orbit-muted/35',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {statusIcon(item.executionStatus)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{describeEntry(item)}</p>
                              <Badge variant="muted" className="normal-case tracking-normal">
                                {item.source}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-orbit-foreground-muted">
                              {formatTime(item.timestamp)} · {item.detectedIntent}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <Card className="h-fit p-4">
            <h3 className="text-sm font-semibold">Execution details</h3>
            {selected ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-orbit-foreground-muted">Command</dt>
                  <dd className="mt-1">{selected.userCommand}</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Intent</dt>
                  <dd className="mt-1">{selected.detectedIntent}</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Status</dt>
                  <dd className="mt-1 capitalize">{selected.executionStatus}</dd>
                </div>
                <div>
                  <dt className="text-orbit-foreground-muted">Execution time</dt>
                  <dd className="mt-1">
                    {selected.executionTimeMs != null
                      ? `${selected.executionTimeMs.toFixed(0)} ms`
                      : '—'}
                  </dd>
                </div>
                {selected.errorMessage ? (
                  <div>
                    <dt className="text-orbit-foreground-muted">Error</dt>
                    <dd className="mt-1 text-orbit-danger">{selected.errorMessage}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-orbit-foreground-muted">Parameters</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-orbit-muted/30 p-2 text-xs">
                    {JSON.stringify(selected.parameters, null, 2)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-orbit-foreground-muted">
                Select an entry to inspect command details.
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
