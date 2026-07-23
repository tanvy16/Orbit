import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/utils/cn'

interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  loading?: boolean
  className?: string
}

export function MetricCard({ label, value, icon: Icon, loading, className }: MetricCardProps) {
  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:border-orbit-accent/20 hover:shadow-lg',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-orbit-foreground-muted">
          {label}
        </p>
        {Icon ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orbit-muted/80 text-orbit-foreground-muted transition-colors group-hover:bg-orbit-accent/10 group-hover:text-orbit-accent">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-orbit-foreground">
          {value}
        </p>
      )}
    </Card>
  )
}
