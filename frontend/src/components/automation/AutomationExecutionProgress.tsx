import { cn } from '@/utils/cn'

export type StepStatus = 'pending' | 'running' | 'done' | 'error'

export interface ExecutionStep {
  label: string
  status: StepStatus
  message?: string
}

interface AutomationExecutionProgressProps {
  workflowName: string
  steps: ExecutionStep[]
}

const statusLabels: Record<StepStatus, string> = {
  pending: 'Waiting…',
  running: 'Executing…',
  done: 'Completed',
  error: 'Failed',
}

const statusColors: Record<StepStatus, string> = {
  pending: 'bg-orbit-foreground-muted/30',
  running: 'bg-orbit-accent animate-pulse',
  done: 'bg-emerald-400',
  error: 'bg-orbit-danger',
}

export function AutomationExecutionProgress({
  workflowName,
  steps,
}: AutomationExecutionProgressProps) {
  return (
    <div className="rounded-xl border border-orbit-accent/25 bg-orbit-accent/5 p-4">
      <p className="text-sm font-semibold">Running: {workflowName}</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-start gap-3">
            <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', statusColors[step.status])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-xs text-orbit-foreground-muted">
                {step.message ?? statusLabels[step.status]}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
