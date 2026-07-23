import type { LucideIcon } from 'lucide-react'

import { OrbitLogo } from '@/components/brand/OrbitLogo'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  showLogo?: boolean
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  showLogo,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-orbit-border/80 bg-orbit-surface/40 px-8 py-16 text-center animate-fade-in',
        className,
      )}
    >
      {showLogo ? (
        <OrbitLogo
          size="lg"
          className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 opacity-[0.07]"
        />
      ) : null}
      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-orbit-border/60 bg-orbit-muted/50 shadow-inner">
        {Icon ? (
          <Icon className="h-7 w-7 text-orbit-accent/80" />
        ) : (
          <OrbitLogo size="xs" className="max-h-8" />
        )}
      </div>
      <h3 className="relative text-base font-semibold tracking-tight text-orbit-foreground">{title}</h3>
      <p className="relative mt-2 max-w-md text-sm leading-relaxed text-orbit-foreground-muted">
        {description}
      </p>
      {action ? <div className="relative mt-6">{action}</div> : null}
    </div>
  )
}
