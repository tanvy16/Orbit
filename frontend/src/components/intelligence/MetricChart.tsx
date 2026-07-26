import { cn } from '@/utils/cn'

interface MetricChartProps {
  values: number[]
  className?: string
  height?: number
  strokeClassName?: string
  max?: number
  fillClassName?: string
}

/** Smooth area-style chart for intelligence telemetry. */
export function MetricChart({
  values,
  className,
  height = 120,
  strokeClassName = 'stroke-orbit-accent',
  fillClassName = 'fill-orbit-accent/15',
  max,
}: MetricChartProps) {
  if (values.length < 2) {
    return (
      <div className={cn('rounded-lg bg-orbit-muted/40', className)} style={{ height }} aria-hidden />
    )
  }

  const computedMax = max ?? Math.max(...values, 1) * 1.1
  const width = 400
  const step = width / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * step
    const clamped = Math.min(computedMax, Math.max(0, v))
    const y = height - (clamped / computedMax) * (height - 8) - 4
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${height} L 0 ${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      style={{ height }}
      preserveAspectRatio="none"
      role="img"
      aria-label="Metric history chart"
    >
      <path d={areaPath} className={fillClassName} />
      <path
        d={linePath}
        fill="none"
        className={cn(strokeClassName, 'fill-none')}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
