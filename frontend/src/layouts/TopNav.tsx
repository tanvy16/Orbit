import { PanelLeft } from 'lucide-react'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { NotificationBell } from '@/components/notifications/NotificationPanel'
import { Button } from '@/components/ui/Button'
import { useUiStore } from '@/stores/ui-store'

interface TopNavProps {
  title?: string
}

export function TopNav({ title = 'Overview' }: TopNavProps) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

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
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  )
}
