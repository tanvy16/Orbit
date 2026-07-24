import type { LucideIcon } from 'lucide-react'

import { Sparkline } from '@/components/monitor/Sparkline'
import { AnimatedMetric } from '@/components/copilot/AnimatedMetric'
import { cn } from '@/utils/cn'

interface TelemetryMetricCardProps {
  icon: LucideIcon
  label: string
  value: number
  displayValue: string
  history: number[]
  subtitle?: string
  sparklineMax?: number
  strokeClassName?: string
  className?: string
}

export function TelemetryMetricCard({
  icon: Icon,
  label,
  value,
  displayValue,
  history,
  subtitle,
  sparklineMax = 100,
  strokeClassName = 'stroke-orbit-accent',
  className,
}: TelemetryMetricCardProps) {
  const sparkValues: number[] =
    history.length >= 2
      ? history
      : history.length === 1 && history[0] != null
        ? [history[0], history[0]]
        : []

  return (
    <div
      className={cn(
        'rounded-lg border border-orbit-border/60 bg-orbit-background/40 p-3 transition-colors duration-300',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-orbit-accent" />
          <span className="text-xs font-medium text-orbit-foreground-muted">{label}</span>
        </div>
        <span className="text-sm font-semibold">
          <AnimatedMetric value={value} format={() => displayValue} />
        </span>
      </div>
      <Sparkline
        values={sparkValues}
        height={36}
        max={sparklineMax}
        strokeClassName={strokeClassName}
        className="mt-2 rounded-md bg-orbit-muted/30"
      />
      {subtitle ? (
        <p className="mt-1.5 text-[11px] text-orbit-foreground-muted">{subtitle}</p>
      ) : null}
    </div>
  )
}
