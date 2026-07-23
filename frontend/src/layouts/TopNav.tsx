import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, PanelLeft } from 'lucide-react'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { routes } from '@/config/app'
import { useUiStore } from '@/stores/ui-store'
import { fetchUnreadCount } from '@/services/notifications-api'
import { cn } from '@/utils/cn'

interface TopNavProps {
  title?: string
}

export function TopNav({ title = 'Overview' }: TopNavProps) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 20_000,
  })

  const unread = unreadQuery.data?.count ?? 0

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-orbit-border/80 bg-orbit-bg/90 px-5 shadow-[0_1px_0_hsl(var(--orbit-border)/0.5)] backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <p className="truncate text-sm font-semibold tracking-tight text-orbit-foreground">{title}</p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link to={routes.notifications} className="relative inline-flex">
          <Button
            variant="ghost"
            size="sm"
            className="relative h-9 w-9 transition-colors hover:bg-orbit-muted/80"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          {unread > 0 ? (
            <span
              className={cn(
                'pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orbit-accent px-1 text-[10px] font-bold text-orbit-accent-foreground shadow-sm',
              )}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
