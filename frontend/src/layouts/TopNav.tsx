import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { useUiStore } from '@/stores/ui-store'
import { PanelLeft } from 'lucide-react'

interface TopNavProps {
  title?: string
}

export function TopNav({ title = 'Overview' }: TopNavProps) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-orbit-border bg-orbit-bg/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium text-orbit-foreground-muted">{title}</p>
      </div>
      <ThemeToggle />
    </header>
  )
}
