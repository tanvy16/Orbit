import { cn } from '@/utils/cn'

interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-orbit-foreground-muted', className)}>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-orbit-border border-t-orbit-accent"
        role="status"
        aria-label={label}
      />
      <p className="text-sm">{label}</p>
    </div>
  )
}
