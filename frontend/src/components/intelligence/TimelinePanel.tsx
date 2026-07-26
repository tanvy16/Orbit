import { useMemo, useState } from 'react'
import type { IntelligenceTimelineEvent } from '@shared/types'

import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatRelativeTime } from '@/utils/cn'

interface TimelinePanelProps {
  events: IntelligenceTimelineEvent[]
  title?: string
  searchable?: boolean
}

export function TimelinePanel({ events, title = 'Live system timeline', searchable = false }: TimelinePanelProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return events
    return events.filter(
      (e) => e.message.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
    )
  }, [events, query])

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-orbit-foreground-muted">
            Continuously updated from telemetry diffs — process lifecycle, spikes, and power events.
          </p>
        </div>
        {searchable ? (
          <Input
            className="max-w-xs"
            placeholder="Search timeline…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>
      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="text-sm text-orbit-foreground-muted">No matching events.</li>
        ) : (
          filtered.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-lg border border-orbit-border/60 px-3 py-2 text-sm"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orbit-accent" />
              <div className="min-w-0 flex-1">
                <p>{event.message}</p>
                <p className="mt-0.5 text-xs text-orbit-foreground-muted">
                  {formatRelativeTime(new Date(event.timestamp).toISOString())}
                  {event.type ? ` · ${event.type.replace(/_/g, ' ')}` : ''}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  )
}
