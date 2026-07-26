import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useServiceStatus } from '@/hooks/use-service-status'
import { cn } from '@/utils/cn'

function StatusDot({ state }: { state: 'pending' | 'ready' | 'error' | 'idle' }) {
  const colors = {
    pending: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]',
    ready: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]',
    error: 'bg-orbit-danger shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    idle: 'bg-orbit-foreground-muted/40',
  }
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colors[state])} />
}

function labelForState(state: 'pending' | 'ready' | 'error' | 'idle', ready: string, pending: string, error: string) {
  if (state === 'ready') return ready
  if (state === 'error') return error
  if (state === 'pending') return pending
  return pending
}

export function SystemStatusWidget() {
  const status = useServiceStatus()

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">System Status</h3>
        {status.isLoading ? <Spinner className="h-4 w-4" /> : null}
      </div>
      <ul className="space-y-2.5 text-sm">
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.electron} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.electron,
              'Electron IPC ready',
              'Connecting Electron IPC…',
              'Electron IPC unavailable',
            )}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.backend} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.backend,
              'FastAPI backend ready',
              'Connecting to backend…',
              status.backendError ?? 'Backend unavailable',
            )}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.chroma} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.chroma,
              'ChromaDB ready',
              'Starting ChromaDB…',
              'ChromaDB unavailable',
            )}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.semanticSearch} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.semanticSearch,
              'Semantic search ready',
              'Loading semantic index…',
              'Semantic search unavailable',
            )}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.aiModels} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.aiModels,
              'AI models ready',
              'Loading AI models…',
              status.aiError ?? 'AI provider unavailable',
            )}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.desktopBridge} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.desktopBridge,
              'Desktop bridge ready',
              'Starting desktop bridge…',
              'Desktop bridge offline',
            )}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <StatusDot state={status.automation} />
          <span className="text-orbit-foreground-muted">
            {labelForState(
              status.automation,
              'Automation engine ready',
              'Loading automation…',
              'Automation unavailable',
            )}
          </span>
        </li>
      </ul>
    </Card>
  )
}
