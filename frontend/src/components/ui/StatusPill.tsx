import { cn } from '@/utils/cn'
import type { StatusLevel } from '@/utils/health-status'

const styles: Record<StatusLevel, string> = {
  healthy: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  offline: 'border-red-500/25 bg-red-500/10 text-red-400',
  neutral: 'border-orbit-border bg-orbit-muted/50 text-orbit-foreground-muted',
}

const dotStyles: Record<StatusLevel, string> = {
  healthy: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
  warning: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]',
  offline: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]',
  neutral: 'bg-orbit-foreground-muted',
}

interface StatusPillProps {
  label: string
  level: StatusLevel
  className?: string
}

export function StatusPill({ label, level, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium capitalize',
        styles[level],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[level])} />
      {label}
    </span>
  )
}
