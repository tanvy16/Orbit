import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

import { Sparkline } from '@/components/monitor/Sparkline'
import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

interface ResourceCardProps {
  to: string
  icon: LucideIcon
  title: string
  value: string
  subtitle?: string
  sparkline?: number[]
  strokeClassName?: string
  className?: string
}

export function ResourceCard({
  to,
  icon: Icon,
  title,
  value,
  subtitle,
  sparkline,
  strokeClassName,
  className,
}: ResourceCardProps) {
  return (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-orbit-accent rounded-xl">
      <Card
        className={cn(
          'cursor-pointer transition-all duration-200 hover:border-orbit-accent/40 hover:shadow-lg hover:shadow-orbit-accent/5',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-orbit-accent" />
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </div>
        {sparkline?.length ? (
          <Sparkline values={sparkline} className="mt-4" strokeClassName={strokeClassName} />
        ) : null}
        {subtitle ? (
          <p className="mt-2 text-xs text-orbit-foreground-muted">{subtitle}</p>
        ) : null}
        <p className="mt-3 text-xs font-medium text-orbit-accent">View analysis →</p>
      </Card>
    </Link>
  )
}
