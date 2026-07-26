interface HistoricalCompareProps {
  current: number
  average: number
  unusual?: boolean
  unit?: string
}

export function HistoricalCompare({ current, average, unusual, unit = '%' }: HistoricalCompareProps) {
  const delta = current - average
  return (
    <div className="rounded-lg border border-orbit-border/70 bg-orbit-muted/20 px-3 py-2 text-sm">
      <p className="text-orbit-foreground-muted">
        Current <span className="font-semibold text-orbit-foreground">{current}{unit}</span>
        {' · '}
        Average <span className="font-semibold text-orbit-foreground">{average}{unit}</span>
        {Math.abs(delta) >= 0.1 ? (
          <span className={delta > 0 ? ' text-amber-400' : ' text-emerald-400'}>
            {' '}
            ({delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit})
          </span>
        ) : null}
      </p>
      {unusual ? (
        <p className="mt-1 text-xs text-amber-400">Current value differs from the recent average.</p>
      ) : null}
    </div>
  )
}
