import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Sparkles, Trash2, Workflow } from 'lucide-react'

import {
  AutomationExecutionProgress,
  type ExecutionStep,
} from '@/components/automation/AutomationExecutionProgress'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  deleteWorkflow,
  fetchWorkflows,
  parseWorkflow,
  saveWorkflow,
  streamWorkflowRun,
  type WorkflowPreview,
} from '@/services/automation-api'
import { ApiError } from '@/services/http'
import { toast } from '@/stores/toast-store'

function buildPendingSteps(workflow: WorkflowPreview): ExecutionStep[] {
  return workflow.steps.map((step) => ({
    label: step.label,
    status: 'pending' as const,
  }))
}

function applyStepEvent(steps: ExecutionStep[], stepNumber: number, patch: Partial<ExecutionStep>): ExecutionStep[] {
  const index = stepNumber - 1
  if (index < 0 || index >= steps.length) return steps
  return steps.map((step, i) => (i === index ? { ...step, ...patch } : step))
}

export function AutomationPage() {
  const queryClient = useQueryClient()
  const runAbortRef = useRef<AbortController | null>(null)
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<WorkflowPreview | null>(null)
  const [runLog, setRunLog] = useState<string | null>(null)
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([])
  const [runningWorkflowName, setRunningWorkflowName] = useState<string | null>(null)
  const [runningWorkflowId, setRunningWorkflowId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const workflowsQuery = useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    refetchInterval: 30_000,
  })

  const parseMutation = useMutation({
    mutationFn: () => parseWorkflow(description.trim()),
    onSuccess: (data) => {
      setPreview(data)
      setError(null)
    },
    onError: (err) => {
      setPreview(null)
      setError(err instanceof ApiError ? err.message : 'Failed to generate workflow')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('Generate a workflow first')
      return saveWorkflow(preview)
    },
    onSuccess: async () => {
      setPreview(null)
      setDescription('')
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const handleRunWorkflow = async (workflowId: number) => {
    const workflow = workflowsQuery.data?.items.find((item) => item.id === workflowId)
    if (!workflow) return

    runAbortRef.current?.abort()
    const controller = new AbortController()
    runAbortRef.current = controller

    setRunningWorkflowId(workflowId)
    setRunningWorkflowName(workflow.name)
    setExecutionSteps(buildPendingSteps(workflow))
    setRunLog(null)

    await streamWorkflowRun(
      workflowId,
      {
        onEvent: (event) => {
          if (event.type === 'workflow' && event.status === 'queued') {
            setRunningWorkflowName(event.workflowName)
            return
          }

          if (event.type === 'step') {
            if (event.status === 'started' || event.status === 'running') {
              setExecutionSteps((prev) =>
                applyStepEvent(prev, event.stepNumber, {
                  status: 'running',
                  message: event.message ?? 'Executing…',
                }),
              )
              return
            }

            if (event.status === 'completed' || event.status === 'failed') {
              setExecutionSteps((prev) =>
                applyStepEvent(prev, event.stepNumber, {
                  status: event.ok ? 'done' : 'error',
                  message: event.message ?? (event.ok ? 'Completed' : 'Failed'),
                }),
              )
            }
            return
          }

          if (event.type === 'complete') {
            const result = event.payload
            const lines = result.steps.map((step) =>
              step.ok ? `✓ ${step.label}` : `✗ ${step.label}: ${step.message}`,
            )
            setRunLog(
              `${result.ok ? 'Automation completed successfully.' : 'Automation failed.'}\n${lines.join('\n')}`,
            )
            toast({
              level: result.ok ? 'success' : 'error',
              title: result.ok ? 'Automation completed' : 'Automation failed',
              message: result.workflowName,
            })
            void queryClient.invalidateQueries({ queryKey: ['action-history'] })
            void queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
            void queryClient.invalidateQueries({ queryKey: ['event-log'] })
          }
        },
        onError: (err) => {
          setExecutionSteps((prev) =>
            prev.map((step) =>
              step.status === 'running' || step.status === 'pending'
                ? { ...step, status: 'error', message: err.message }
                : step,
            ),
          )
          setRunLog(err.message)
          toast({ level: 'error', title: 'Automation failed', message: err.message })
        },
      },
      controller.signal,
    )

    setRunningWorkflowId(null)
    window.setTimeout(() => {
      setRunningWorkflowName(null)
      setExecutionSteps([])
    }, 4000)
  }

  return (
    <>
      <PageHeader
        title="Automation"
        description="Describe what Orbit should automate in plain language. Orbit converts it into executable desktop steps."
        actions={
          <Badge variant="accent" className="gap-1 normal-case tracking-normal">
            <Sparkles className="h-3 w-3" />
            AI workflow creator
          </Badge>
        }
      />

      <Card className="mb-6 p-5">
        <h2 className="text-sm font-semibold">Create New Automation</h2>
        <p className="mt-1 text-sm text-orbit-foreground-muted">
          Example: “Open Chrome, VS Code and my Downloads folder”
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Start my coding setup"
          />
          <Button
            onClick={() => parseMutation.mutate()}
            disabled={!description.trim()}
            loading={parseMutation.isPending}
          >
            Generate Workflow
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-orbit-danger">{error}</p> : null}
      </Card>

      {preview ? (
        <Card className="mb-6 border-orbit-accent/20 bg-orbit-accent/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{preview.name}</h3>
              <p className="mt-1 text-sm text-orbit-foreground-muted">{preview.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Save Automation
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {preview.steps.map((step) => (
              <li key={step.stepNumber} className="flex items-center gap-2 text-sm">
                <span className="text-emerald-500">✓</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {runningWorkflowName && executionSteps.length ? (
        <Card className="mb-6" interactive={false}>
          <AutomationExecutionProgress workflowName={runningWorkflowName} steps={executionSteps} />
        </Card>
      ) : null}

      {runLog ? <Card className="mb-6 whitespace-pre-wrap p-4 text-sm">{runLog}</Card> : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-orbit-accent" />
          <h2 className="text-sm font-semibold">Saved Automations</h2>
        </div>

        {workflowsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} interactive={false}>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-3 h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : workflowsQuery.isError ? (
          <ErrorState
            message={
              workflowsQuery.error instanceof Error
                ? workflowsQuery.error.message
                : 'Failed to load automations'
            }
            onRetry={() => void workflowsQuery.refetch()}
          />
        ) : (workflowsQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No saved automations"
            description="Generate a workflow above and save it to run repeatable desktop setups."
          />
        ) : (
          <ul className="space-y-3">
            {workflowsQuery.data?.items.map((workflow) => (
              <li key={workflow.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-medium">{workflow.name}</h3>
                    <p className="mt-1 text-sm text-orbit-foreground-muted">
                      {workflow.steps.length} steps · {workflow.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleRunWorkflow(workflow.id)}
                      loading={runningWorkflowId === workflow.id}
                      disabled={runningWorkflowId !== null && runningWorkflowId !== workflow.id}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await deleteWorkflow(workflow.id)
                        await queryClient.invalidateQueries({ queryKey: ['workflows'] })
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
