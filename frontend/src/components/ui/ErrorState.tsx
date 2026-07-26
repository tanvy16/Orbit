import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/utils/cn'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ErrorStateProps {
  title?: string
  message: string
  technicalDetail?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorState({
  title = 'Unable to complete this action',
  message,
  technicalDetail,
  onRetry,
  className,
  compact,
}: ErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false)
  const detail = technicalDetail ?? message

  return (
    <Card
      padding={compact ? 'md' : 'lg'}
      interactive={false}
      className={cn(
        'border-orbit-danger/20 bg-gradient-to-b from-orbit-danger/[0.06] to-orbit-surface',
        compact ? 'text-left' : 'text-center',
        className,
      )}
    >
      <div className={cn('flex gap-3', compact ? 'items-start' : 'flex-col items-center')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orbit-danger/20 bg-orbit-danger/10">
          <AlertCircle className="h-5 w-5 text-orbit-danger" />
        </div>
        <div className={cn('min-w-0', compact ? 'flex-1' : 'text-center')}>
          <h3 className="text-base font-semibold tracking-tight text-orbit-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-orbit-foreground-muted">{message}</p>
          {detail && detail !== message ? (
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-orbit-accent hover:underline"
            >
              {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Technical details
            </button>
          ) : null}
          {showDetail ? (
            <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-orbit-muted/50 p-3 text-left text-xs text-orbit-foreground-muted">
              {detail}
            </pre>
          ) : null}
          {onRetry ? (
            <Button className={cn('mt-4', !compact && 'mx-auto')} variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
