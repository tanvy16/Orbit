import { AlertCircle } from 'lucide-react'

import { cn } from '@/utils/cn'

import { Button } from '@/components/ui/Button'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-orbit-danger/30 bg-orbit-danger/5 px-8 py-12 text-center',
        className,
      )}
    >
      <AlertCircle className="mb-3 h-8 w-8 text-orbit-danger" />
      <h3 className="text-base font-semibold text-orbit-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-orbit-foreground-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-6" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
