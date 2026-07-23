import { cn } from '@/utils/cn'

interface SparklineProps {
  values: number[]
  className?: string
  height?: number
  strokeClassName?: string
  max?: number
}

export function Sparkline({
  values,
  className,
  height = 48,
  strokeClassName = 'stroke-orbit-accent',
  max = 100,
}: SparklineProps) {
  if (values.length < 2) {
    return (
      <div
        className={cn('rounded-lg bg-orbit-muted/40', className)}
        style={{ height }}
        aria-hidden
      />
    )
  }

  const width = 200
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => {
      const x = i * step
      const clamped = Math.min(max, Math.max(0, v))
      const y = height - (clamped / max) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        fill="none"
        className={cn(strokeClassName, 'fill-none')}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  )
}
