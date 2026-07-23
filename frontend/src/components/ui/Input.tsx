import type { InputHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-orbit-border bg-orbit-surface px-3 text-sm text-orbit-foreground shadow-sm transition-colors placeholder:text-orbit-foreground-muted focus-visible:border-orbit-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-ring/40',
        className,
      )}
      {...props}
    />
  )
}
