import { cn } from '@/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'muted'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        variant === 'default' && 'bg-orbit-muted text-orbit-foreground-muted',
        variant === 'accent' && 'bg-orbit-accent/15 text-orbit-accent',
        variant === 'muted' && 'bg-orbit-border/40 text-orbit-foreground-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}
