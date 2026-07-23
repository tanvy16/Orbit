import { cn } from '@/utils/cn'

interface SpinnerProps {
  className?: string
  label?: string
  size?: 'sm' | 'md'
}

export function Spinner({ className, label = 'Loading', size = 'md' }: SpinnerProps) {
  const dim = size === 'sm' ? 'h-5 w-5 border' : 'h-8 w-8 border-2'
  return (
    <div className={cn('flex flex-col items-center gap-3 text-orbit-foreground-muted', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-orbit-border border-t-orbit-accent',
          dim,
        )}
        role="status"
        aria-label={label}
      />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  )
}
