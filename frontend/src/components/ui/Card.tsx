import { cn } from '@/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-orbit-border bg-orbit-surface shadow-panel transition-shadow duration-200',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
