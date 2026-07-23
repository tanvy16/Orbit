import { AlertCircle } from 'lucide-react'

import { cn } from '@/utils/cn'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
  compact,
}: ErrorStateProps) {
  return (
    <Card
      padding={compact ? 'md' : 'lg'}
      className={cn(
        'border-orbit-danger/20 bg-gradient-to-b from-orbit-danger/[0.06] to-orbit-surface text-center',
        className,
      )}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-orbit-danger/20 bg-orbit-danger/10">
        <AlertCircle className="h-6 w-6 text-orbit-danger" />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-orbit-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-orbit-foreground-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-6" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Card>
  )
}
