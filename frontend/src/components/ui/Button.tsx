import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-orbit-accent text-orbit-accent-foreground hover:brightness-110 active:brightness-95 shadow-sm disabled:opacity-50',
  secondary:
    'bg-orbit-muted text-orbit-foreground hover:bg-orbit-border/50 active:bg-orbit-border/70 border border-orbit-border/60',
  ghost:
    'hover:bg-orbit-muted text-orbit-foreground-muted hover:text-orbit-foreground active:bg-orbit-muted/80',
  danger:
    'bg-orbit-danger/10 text-orbit-danger hover:bg-orbit-danger/20 active:bg-orbit-danger/30 border border-orbit-danger/20',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-orbit-bg disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled ?? loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {loading ? <span className="sr-only">Loading</span> : null}
      {children}
    </button>
  )
}
