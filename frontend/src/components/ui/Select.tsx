import type { SelectHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-9 rounded-lg border border-orbit-border bg-orbit-surface px-3 text-sm text-orbit-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-ring',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
