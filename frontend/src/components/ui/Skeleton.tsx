import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-shimmer rounded-lg bg-orbit-muted/80', className)}
      aria-hidden
    />
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 shadow-panel">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  )
}

export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-0 divide-y divide-orbit-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-orbit-border bg-orbit-surface p-5 shadow-panel"
        >
          <div className="flex justify-between gap-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-[85%]" />
        </div>
      ))}
    </div>
  )
}

export function SettingsFormSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-6 shadow-panel">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-6 shadow-panel">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    </div>
  )
}
