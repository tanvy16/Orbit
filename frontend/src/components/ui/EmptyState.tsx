import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-orbit-border bg-orbit-surface/50 px-8 py-16 text-center animate-fade-in">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orbit-muted">
        <Icon className="h-6 w-6 text-orbit-foreground-muted" />
      </div>
      <h3 className="text-base font-semibold text-orbit-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-orbit-foreground-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
