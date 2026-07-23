import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
  phase?: number
}

export function PlaceholderPage({ title, description, icon, phase }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={phase ? <Badge variant="accent">Phase {phase}</Badge> : undefined}
      />
      <EmptyState
        icon={icon}
        title={`${title} coming soon`}
        description="The foundation is ready. This module will be implemented in a future phase without restructuring the core architecture."
      />
    </>
  )
}
