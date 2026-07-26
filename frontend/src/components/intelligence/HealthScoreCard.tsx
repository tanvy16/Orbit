import type { IntelligenceOverview } from '@shared/types'

import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/utils/cn'

interface HealthScoreCardProps {
  health: IntelligenceOverview['health']
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 55) return 'Fair'
  return 'Needs attention'
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 75) return 'text-sky-400'
  if (score >= 55) return 'text-amber-400'
  return 'text-orbit-danger'
}

export function HealthScoreCard({ health }: HealthScoreCardProps) {
  const factors = Object.values(health.factors ?? {})

  return (
    <Card className="border-orbit-accent/20 bg-gradient-to-br from-orbit-accent/10 to-transparent">
      <p className="text-xs font-medium uppercase tracking-wide text-orbit-foreground-muted">
        System Health
      </p>
      <div className="mt-2 flex items-end gap-3">
        <span className={cn('text-5xl font-bold tabular-nums', scoreColor(health.score))}>
          {health.score}
        </span>
        <div className="mb-2">
          <p className="text-sm font-semibold">/ 100</p>
          <p className={cn('text-sm font-medium', scoreColor(health.score))}>{scoreLabel(health.score)}</p>
        </div>
      </div>
      <ProgressBar className="mt-4" value={health.score} />
      {factors.length ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {factors.map((factor) => (
            <div key={factor.label} className="rounded-lg bg-orbit-muted/30 px-2 py-1.5">
              <p className="text-[10px] uppercase text-orbit-foreground-muted">{factor.label}</p>
              <p className="text-sm font-semibold tabular-nums">{factor.score}</p>
            </div>
          ))}
        </div>
      ) : null}
      {health.explanation ? (
        <p className="mt-3 text-xs text-orbit-foreground-muted">{health.explanation}</p>
      ) : null}
      {health.detectedIssues?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-orbit-foreground-muted">
          {health.detectedIssues.slice(0, 4).map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
