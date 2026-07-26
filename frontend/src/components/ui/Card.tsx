import { cn } from '@/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'md' | 'lg'
  interactive?: boolean
}

export function Card({ children, className, padding = 'md', interactive = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-orbit-border/80 bg-orbit-surface/95 shadow-panel backdrop-blur-sm transition-all duration-200',
        interactive && 'hover:border-orbit-border hover:shadow-lg',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
