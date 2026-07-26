import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/app'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
} from '@/services/notifications-api'
import { toast } from '@/stores/toast-store'
import { formatRelativeTime } from '@/utils/cn'
import { cn } from '@/utils/cn'

const levelStyles = {
  success: 'border-l-emerald-400',
  warning: 'border-l-amber-400',
  error: 'border-l-orbit-danger',
  info: 'border-l-orbit-accent',
} as const

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const prevUnread = useRef<number | null>(null)

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 15_000,
    enabled: open,
  })

  const listQuery = useQuery({
    queryKey: ['notifications', 'panel'],
    queryFn: () => fetchNotifications(false).then((items) => items.slice(0, 8)),
    enabled: open,
  })

  useEffect(() => {
    const count = unreadQuery.data?.count
    if (count == null || prevUnread.current == null) {
      prevUnread.current = count ?? 0
      return
    }
    if (count > prevUnread.current) {
      toast({ level: 'info', title: 'New notification', message: 'You have unread updates in Orbit.' })
    }
    prevUnread.current = count
  }, [unreadQuery.data?.count])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-orbit-border/80 bg-orbit-surface/95 shadow-xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-orbit-border/70 px-4 py-3">
        <p className="text-sm font-semibold">Notifications</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await markAllNotificationsRead()
            await queryClient.invalidateQueries({ queryKey: ['notifications'] })
          }}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </Button>
      </div>
      <div className="max-h-80 overflow-y-auto p-2">
        {listQuery.isLoading && !listQuery.data ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : null}
        {listQuery.data?.length ? (
          listQuery.data.map((item) => (
            <Card
              key={item.id}
              padding="md"
              interactive={false}
              className={cn(
                'mb-2 border-l-2 p-3 last:mb-0',
                levelStyles[item.level as keyof typeof levelStyles] ?? levelStyles.info,
                !item.read && 'bg-orbit-accent/5',
              )}
            >
              <p className="text-sm font-medium">{item.title}</p>
              {item.body ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-orbit-foreground-muted">{item.body}</p>
              ) : null}
              <p className="mt-1 text-[10px] text-orbit-foreground-muted">
                {formatRelativeTime(item.createdAt)}
              </p>
            </Card>
          ))
        ) : (
          !listQuery.isLoading && (
            <p className="px-3 py-8 text-center text-sm text-orbit-foreground-muted">
              No notifications yet.
            </p>
          )
        )}
      </div>
      <div className="border-t border-orbit-border/70 p-2">
        <Link
          to={routes.notifications}
          onClick={onClose}
          className="block rounded-lg px-3 py-2 text-center text-xs font-medium text-orbit-accent hover:bg-orbit-muted/50"
        >
          Open notification center
        </Link>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 20_000,
  })
  const unread = unreadQuery.data?.count ?? 0

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 transition-colors hover:bg-orbit-muted/80"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
      </Button>
      {unread > 0 ? (
        <span className="pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orbit-accent px-1 text-[10px] font-bold text-orbit-accent-foreground shadow-sm">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
