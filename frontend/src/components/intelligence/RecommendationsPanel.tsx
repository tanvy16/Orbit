import type { CopilotRecommendation } from '@shared/types'

import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

interface RecommendationsPanelProps {
  items: CopilotRecommendation[]
}

const severityStyles: Record<string, string> = {
  high: 'border-orbit-danger/30 bg-orbit-danger/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-orbit-border/70',
}

export function RecommendationsPanel({ items }: RecommendationsPanelProps) {
  return (
    <Card>
      <h2 className="text-sm font-semibold">AI recommendations</h2>
      <p className="mt-1 text-xs text-orbit-foreground-muted">
        Insights grounded in collected telemetry — never fabricated.
      </p>
      <ul className="mt-4 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-orbit-foreground-muted">No recommendations at this time.</li>
        ) : (
          items.map((item, index) => (
            <li
              key={`${item.title}-${index}`}
              className={cn(
                'rounded-lg border px-3 py-2.5',
                severityStyles[String(item.severity)] ?? severityStyles.low,
              )}
            >
              <p className="text-sm font-medium">{item.title}</p>
              {item.detail ? (
                <p className="mt-1 text-xs text-orbit-foreground-muted">{item.detail}</p>
              ) : null}
              {item.action ? (
                <p className="mt-2 text-xs font-medium text-orbit-accent">{item.action}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </Card>
  )
}
