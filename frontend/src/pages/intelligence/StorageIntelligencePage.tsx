import { useQuery } from '@tanstack/react-query'

import { IntelligenceDetailLayout } from '@/components/intelligence/IntelligenceDetailLayout'
import { Sparkline } from '@/components/monitor/Sparkline'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { fetchIntelligenceHistory, fetchStorageIntelligence } from '@/services/intelligence-api'
import { formatBytes } from '@/utils/format-bytes'

export function StorageIntelligencePage() {
  const query = useQuery({ queryKey: ['intel-storage'], queryFn: fetchStorageIntelligence, refetchInterval: 60_000 })
  const history = useQuery({
    queryKey: ['intel-history', 'disk', 24],
    queryFn: () => fetchIntelligenceHistory('disk', 24),
    refetchInterval: 60_000,
  })

  if (query.isError) {
    return (
      <IntelligenceDetailLayout title="Storage Intelligence" description="Disk capacity and cleanup analysis.">
        <ErrorState message={query.error instanceof Error ? query.error.message : 'Failed'} onRetry={() => void query.refetch()} />
      </IntelligenceDetailLayout>
    )
  }

  const folders = (query.data?.largestFolders as Array<{ path: string; sizeBytes: number }>) ?? []
  const recommendations = (query.data?.recommendations as string[]) ?? []

  return (
    <IntelligenceDetailLayout
      title="Storage Intelligence"
      description="Capacity, largest folders, and data-backed cleanup recommendations."
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Primary drive usage</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{String(query.data?.usagePercent ?? '—')}%</p>
          <ProgressBar className="mt-4" value={Number(query.data?.usagePercent ?? 0)} />
          <p className="mt-2 text-sm text-orbit-foreground-muted">
            {formatBytes(Number(query.data?.freeBytes ?? 0))} free of {formatBytes(Number(query.data?.totalBytes ?? 0))}
          </p>
          {query.data?.readBytesPerSec != null ? (
            <p className="mt-2 text-sm">Read {formatBytes(Number(query.data.readBytesPerSec))}/s · Write {formatBytes(Number(query.data.writeBytesPerSec ?? 0))}/s</p>
          ) : null}
          {query.data?.smartStatus ? <p className="mt-2 text-sm">SMART: {String(query.data.smartStatus)}</p> : null}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Usage trend — 24h</h2>
          <Sparkline values={(history.data?.points ?? []).map((p) => p.value)} className="mt-4" strokeClassName="stroke-cyan-400" />
          <p className="mt-3 text-sm">{String(query.data?.aiSummary ?? '')}</p>
        </Card>
      </div>
      {recommendations.length ? (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold">Recommendations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recommendations.map((rec) => (
              <li key={rec}>• {rec}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card padding="none" className="mb-6 overflow-hidden">
        <h2 className="border-b border-orbit-border px-5 py-4 text-sm font-semibold">Largest files (Downloads sample)</h2>
        <table className="min-w-full text-sm">
          <tbody>
            {((query.data?.largestFiles as Array<{ path: string; sizeBytes: number }>) ?? []).map((row) => (
              <tr key={row.path} className="border-t border-orbit-border">
                <td className="px-4 py-2 truncate max-w-md">{row.path.split(/[/\\]/).pop()}</td>
                <td className="px-4 py-2 tabular-nums text-right">{formatBytes(row.sizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card padding="none" className="overflow-hidden">
        <h2 className="border-b border-orbit-border px-5 py-4 text-sm font-semibold">Largest sampled folders</h2>
        <table className="min-w-full text-sm">
          <tbody>
            {folders.map((row) => (
              <tr key={row.path} className="border-t border-orbit-border">
                <td className="px-4 py-2 truncate max-w-md">{row.path}</td>
                <td className="px-4 py-2 tabular-nums text-right">{formatBytes(row.sizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </IntelligenceDetailLayout>
  )
}
