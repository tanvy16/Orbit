import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications-api'
import { cn } from '@/utils/cn'

const levelStyles: Record<string, string> = {
  info: 'border-orbit-border',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  error: 'border-orbit-danger/30 bg-orbit-danger/5',
}

function NotificationsSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Card>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-24" />
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(false),
    refetchInterval: 15_000,
  })

  if (notificationsQuery.isLoading) {
    return (
      <>
        <PageHeader
          title="Notifications"
          description="Indexing progress, scan results, and background task alerts."
        />
        <NotificationsSkeleton />
      </>
    )
  }

  if (notificationsQuery.isError) {
    return (
      <>
        <PageHeader title="Notifications" description="Indexing progress and system alerts." />
        <ErrorState
          message={
            notificationsQuery.error instanceof Error
              ? notificationsQuery.error.message
              : 'Failed to load notifications'
          }
          onRetry={() => void notificationsQuery.refetch()}
        />
      </>
    )
  }

  const items = notificationsQuery.data ?? []

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Indexing progress, scan results, and background task alerts."
        actions={
          items.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void markAllNotificationsRead().then(() =>
                  queryClient.invalidateQueries({ queryKey: ['notifications'] }),
                )
              }
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          showLogo
          title="No notifications yet"
          description="Indexing and watcher events will appear here as your workspace stays in sync."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card
                className={cn(
                  'border transition-shadow duration-200 hover:shadow-md',
                  levelStyles[item.level] ?? levelStyles.info,
                  !item.read && 'ring-1 ring-orbit-accent/25',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant="muted">{item.category}</Badge>
                      {!item.read ? <Badge variant="accent">New</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-orbit-foreground-muted">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-orbit-foreground-muted">{item.createdAt}</p>
                  </div>
                  {!item.read ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void markNotificationRead(item.id).then(() =>
                          queryClient.invalidateQueries({ queryKey: ['notifications'] }),
                        )
                      }
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
