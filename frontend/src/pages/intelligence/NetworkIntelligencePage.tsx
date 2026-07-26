import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { HistoricalCompare } from '@/components/intelligence/HistoricalCompare'
import { IntelligenceDetailLayout } from '@/components/intelligence/IntelligenceDetailLayout'
import { MetricChart } from '@/components/intelligence/MetricChart'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { fetchNetworkIntelligence } from '@/services/intelligence-api'
import { formatBitrate } from '@/utils/format-bytes'

export function NetworkIntelligencePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['intel-network'], queryFn: fetchNetworkIntelligence, refetchInterval: 5000 })

  if (query.isError) {
    return (
      <IntelligenceDetailLayout title="Network Intelligence" description="Live bandwidth and connection analysis.">
        <ErrorState message={query.error instanceof Error ? query.error.message : 'Failed'} onRetry={() => void query.refetch()} />
      </IntelligenceDetailLayout>
    )
  }

  const connections = (query.data?.connections as Array<Record<string, unknown>>) ?? []
  const selected = connections.find((c) => c.id === selectedId)
  const historyDown = query.data?.historyDown as { points: { value: number }[]; current: number; average: number; unusual: boolean } | undefined
  const historyUp = query.data?.historyUp as { points: { value: number }[]; current: number; average: number; unusual: boolean } | undefined
  const dnsEntries = (query.data?.dnsEntries as Array<{ entry: string; data: string }>) ?? []

  return (
    <IntelligenceDetailLayout title="Network Intelligence" description="Bandwidth trends, connections, and application traffic.">
      <Card className="mb-6">
        <p className="text-sm">{String(query.data?.aiSummary ?? '')}</p>
      </Card>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Download</p>
          <p className="text-2xl font-bold">{formatBitrate(Number(query.data?.downloadBytesPerSec ?? 0))}</p>
          <MetricChart values={(historyDown?.points ?? []).map((p) => p.value)} className="mt-3" strokeClassName="stroke-sky-400" fillClassName="fill-sky-400/15" />
          {historyDown ? <HistoricalCompare current={Math.round(historyDown.current / 1024)} average={Math.round(historyDown.average / 1024)} unusual={historyDown.unusual} unit=" KB/s" /> : null}
        </Card>
        <Card>
          <p className="text-xs text-orbit-foreground-muted">Upload</p>
          <p className="text-2xl font-bold">{formatBitrate(Number(query.data?.uploadBytesPerSec ?? 0))}</p>
          <MetricChart values={(historyUp?.points ?? []).map((p) => p.value)} className="mt-3" strokeClassName="stroke-indigo-400" fillClassName="fill-indigo-400/15" />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="none" className="max-h-96 overflow-y-auto">
          <h2 className="sticky top-0 border-b border-orbit-border bg-orbit-surface px-5 py-4 text-sm font-semibold">Connection explorer</h2>
          <ul className="divide-y divide-orbit-border text-xs">
            {connections.slice(0, 40).map((conn) => (
              <li key={String(conn.id)}>
                <button type="button" className="w-full px-4 py-2 text-left hover:bg-orbit-muted/20" onClick={() => setSelectedId(String(conn.id))}>
                  <p className="font-medium">{String(conn.processName ?? 'unknown')} · {String(conn.protocol)}</p>
                  <p className="truncate text-orbit-foreground-muted">{String(conn.localAddress)} → {String(conn.remoteAddress ?? '—')}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Connection detail</h2>
          {selected ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-xs text-orbit-foreground-muted">Application</dt><dd>{String(selected.applicationName)}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Protocol</dt><dd>{String(selected.protocol)} · {String(selected.status)}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Source</dt><dd>{String(selected.localAddress)}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">Destination</dt><dd>{String(selected.remoteAddress ?? '—')}</dd></div>
              <div><dt className="text-xs text-orbit-foreground-muted">PID</dt><dd>{String(selected.pid ?? '—')}</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-orbit-foreground-muted">Select a connection to inspect.</p>
          )}
          {dnsEntries.length ? (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase text-orbit-foreground-muted">DNS cache (sample)</h3>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                {dnsEntries.map((d) => (
                  <li key={d.entry}>{d.entry} → {d.data}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>
    </IntelligenceDetailLayout>
  )
}
