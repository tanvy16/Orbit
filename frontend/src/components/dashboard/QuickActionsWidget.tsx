import { Link } from 'react-router-dom'
import { Bot, FileStack, Search, Workflow } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { routes } from '@/config/app'
import { cn } from '@/utils/cn'

const actions = [
  { label: 'Ask Copilot', path: routes.copilot, icon: Bot, description: 'Natural language control' },
  { label: 'Search documents', path: routes.search, icon: Search, description: 'Semantic search' },
  { label: 'Browse files', path: routes.documents, icon: FileStack, description: 'Indexed documents' },
  { label: 'Run automation', path: routes.automation, icon: Workflow, description: 'Desktop workflows' },
] as const

export function QuickActionsWidget() {
  return (
    <Card>
      <h3 className="text-sm font-semibold">Quick Actions</h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.path}
            to={action.path}
            className={cn(
              'group flex items-center gap-3 rounded-lg border border-orbit-border/60 bg-orbit-muted/20 px-3 py-3 transition-all duration-150',
              'hover:border-orbit-accent/30 hover:bg-orbit-accent/5 hover:shadow-sm',
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orbit-muted/80 text-orbit-foreground-muted transition-colors group-hover:bg-orbit-accent/15 group-hover:text-orbit-accent">
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-orbit-foreground-muted">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}
