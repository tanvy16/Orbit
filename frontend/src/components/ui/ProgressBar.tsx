import { cn } from '@/utils/cn'

interface ProgressBarProps {
  value: number
  className?: string
  label?: string
}

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-orbit-foreground-muted">{label}</p>
          <span className="text-xs tabular-nums text-orbit-foreground-muted">{clamped}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-orbit-muted/80 ring-1 ring-orbit-border/50">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-orbit-accent/90 to-orbit-accent transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="absolute inset-0 animate-shimmer rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  )
}
