import { cn } from '@/utils/cn'

interface ProgressBarProps {
  value: number
  className?: string
  label?: string
}

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('space-y-1', className)}>
      {label ? <p className="text-xs text-orbit-foreground-muted">{label}</p> : null}
      <div className="h-2 overflow-hidden rounded-full bg-orbit-muted">
        <div
          className="h-full rounded-full bg-orbit-accent transition-all duration-300"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
