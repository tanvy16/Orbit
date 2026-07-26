import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchActivityFeed, type ActivityItem } from '@/services/activity-api'
import { formatRelativeTime } from '@/utils/cn'
import { cn } from '@/utils/cn'

const levelColors = {
  success: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]',
  warning: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]',
  info: 'bg-orbit-accent shadow-[0_0_8px_rgba(94,179,255,0.4)]',
  error: 'bg-orbit-danger shadow-[0_0_8px_rgba(239,68,68,0.4)]',
} as const

function FeedItem({ item }: { item: ActivityItem }) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <div className="flex flex-col items-center">
        <span className={cn('h-2.5 w-2.5 rounded-full', levelColors[item.level])} />
        <span className="mt-1 w-px flex-1 bg-orbit-border/70" />
      </div>
      <div className="min-w-0 flex-1 -mt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{item.title}</p>
          {item.timestamp ? (
            <time className="text-xs tabular-nums text-orbit-foreground-muted">
              {formatRelativeTime(item.timestamp)}
            </time>
          ) : null}
        </div>
        {item.detail ? (
          <p className="mt-1 text-sm text-orbit-foreground-muted">{item.detail}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-md bg-orbit-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orbit-foreground-muted">
            {item.kind}
          </span>
          {item.category ? (
            <span className="rounded-md bg-orbit-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orbit-foreground-muted">
              {item.category}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function ActivityPage() {
  const query = useQuery({
    queryKey: ['activity-feed', 100],
    queryFn: () => fetchActivityFeed(100),
    refetchInterval: 10_000,
  })

  return (
    <>
      <PageHeader
        title="Activity Center"
        description="Live timeline of indexing, automations, desktop actions, and system events."
      />

      {query.isLoading && !query.data ? (
        <Card>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      ) : null}

      {query.isError ? (
        <ErrorState
          title="Activity feed unavailable"
          message={
            query.error instanceof Error ? query.error.message : 'Could not load activity timeline'
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data ? (
        <Card padding="lg">
          <div className="mb-6 flex items-center gap-2">
            <Activity className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">Live feed</h2>
            <span className="text-xs text-orbit-foreground-muted">· updates every 10s</span>
          </div>
          {query.data.items.length ? (
            <ul>
              {query.data.items.map((item) => (
                <FeedItem key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center text-sm text-orbit-foreground-muted">
              No activity yet. Index documents, run automations, or use Copilot to populate this feed.
            </p>
          )}
        </Card>
      ) : null}
    </>
  )
}
