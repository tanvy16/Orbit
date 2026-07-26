import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/app'
import { fetchActivityFeed, type ActivityItem } from '@/services/activity-api'
import { formatRelativeTime } from '@/utils/cn'
import { cn } from '@/utils/cn'

const levelColors = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  info: 'bg-orbit-accent',
  error: 'bg-orbit-danger',
} as const

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', levelColors[item.level])} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        {item.detail ? (
          <p className="truncate text-xs text-orbit-foreground-muted">{item.detail}</p>
        ) : null}
      </div>
      {item.timestamp ? (
        <time className="shrink-0 text-[11px] tabular-nums text-orbit-foreground-muted">
          {formatRelativeTime(item.timestamp)}
        </time>
      ) : null}
    </li>
  )
}

export function RecentActivityWidget({ limit = 6 }: { limit?: number }) {
  const query = useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: () => fetchActivityFeed(limit),
    refetchInterval: 15_000,
  })

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-orbit-accent" />
          <h3 className="text-sm font-semibold">Recent Activity</h3>
        </div>
        <Link
          to={routes.activity}
          className="inline-flex items-center gap-1 text-xs font-medium text-orbit-accent hover:underline"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {query.isLoading && !query.data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : null}
      {query.data?.items.length ? (
        <ul className="divide-y divide-orbit-border/60">
          {query.data.items.slice(0, limit).map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        !query.isLoading && (
          <p className="py-6 text-center text-sm text-orbit-foreground-muted">
            Activity will appear here as Orbit indexes, automates, and executes actions.
          </p>
        )
      )}
    </Card>
  )
}
