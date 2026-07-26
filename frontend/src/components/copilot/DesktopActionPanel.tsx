import { FolderOpen, Play, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import type { DesktopActionCandidate, DesktopActionPlan } from '@shared/types'

interface DesktopActionPanelProps {
  plan: DesktopActionPlan
  busy?: boolean
  onConfirm: () => void
  onChoose: (candidate: DesktopActionCandidate) => void
}

export function DesktopActionPanel({ plan, busy, onConfirm, onChoose }: DesktopActionPanelProps) {
  if (plan.status === 'awaiting_choice' && plan.candidates?.length) {
    return (
      <div className="mt-3 space-y-2 rounded-xl border border-orbit-border/70 bg-orbit-background/40 p-3">
        <p className="text-xs font-medium text-orbit-foreground-muted">Select a file to open</p>
        <div className="flex flex-col gap-2">
          {plan.candidates.map((candidate) => (
            <Button
              key={candidate.path}
              type="button"
              variant="secondary"
              size="sm"
              className="justify-start gap-2 text-left"
              disabled={busy}
              onClick={() => onChoose(candidate)}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{candidate.label}</span>
            </Button>
          ))}
        </div>
      </div>
    )
  }

  if (plan.requiresConfirmation) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <div className="mb-2 flex items-start gap-2 text-xs text-orbit-foreground-muted">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>{plan.confirmationMessage || 'This action requires confirmation.'}</span>
        </div>
        <Button type="button" size="sm" disabled={busy} onClick={onConfirm} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Confirm and run
        </Button>
      </div>
    )
  }

  return null
}
