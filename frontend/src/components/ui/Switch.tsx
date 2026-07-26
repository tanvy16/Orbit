import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
}

export function Switch({ checked, onCheckedChange, label, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-ring focus-visible:ring-offset-2 focus-visible:ring-offset-orbit-bg disabled:opacity-50',
        checked ? 'bg-orbit-accent' : 'bg-orbit-border',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
