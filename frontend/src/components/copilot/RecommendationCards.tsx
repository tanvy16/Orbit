import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { motion } from 'framer-motion'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { CopilotChatResponse } from '@shared/types'
import { cn } from '@/utils/cn'

interface RecommendationCardsProps {
  recommendations: CopilotChatResponse['recommendations'] | undefined
}

function severityIcon(severity: string) {
  if (severity === 'high') return AlertTriangle
  if (severity === 'medium') return Info
  return CheckCircle2
}

function severityBadgeVariant(severity: string): 'accent' | 'default' | 'muted' {
  if (severity === 'high') return 'accent'
  if (severity === 'medium') return 'default'
  return 'muted'
}

export function RecommendationCards({ recommendations }: RecommendationCardsProps) {
  if (!recommendations?.length) return null

  return (
    <Card>
      <h3 className="text-sm font-semibold">Recommendations</h3>
      <ul className="mt-3 space-y-2.5">
        {recommendations.map((rec, index) => {
          const Icon = severityIcon(rec.severity)
          return (
            <motion.li
              key={`${rec.title}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className={cn(
                'rounded-xl border border-orbit-border/70 bg-orbit-background/40 p-3',
                'transition-shadow duration-200 hover:shadow-md',
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-md bg-orbit-muted/70 p-1.5">
                  <Icon className="h-3.5 w-3.5 text-orbit-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={severityBadgeVariant(rec.severity)}>{rec.severity}</Badge>
                    <span className="text-sm font-medium">{rec.title}</span>
                  </div>
                  {rec.detail ? (
                    <p className="mt-1 text-sm leading-relaxed text-orbit-foreground-muted">
                      {rec.detail}
                    </p>
                  ) : null}
                  {rec.action ? (
                    <p className="mt-2 rounded-lg bg-orbit-muted/50 px-2.5 py-1.5 text-xs text-orbit-foreground">
                      {rec.action}
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </Card>
  )
}
