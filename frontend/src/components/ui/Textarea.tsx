import type { TextareaHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-[88px] w-full resize-y rounded-lg border border-orbit-border bg-orbit-surface px-3 py-2.5 text-sm text-orbit-foreground shadow-sm transition-colors placeholder:text-orbit-foreground-muted focus-visible:border-orbit-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-ring/40',
        className,
      )}
      {...props}
    />
  )
}
