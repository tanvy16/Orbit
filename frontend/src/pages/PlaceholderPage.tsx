import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        showLogo
        title={`${title} is on the way`}
        description="We're building this module with the same care as the rest of Orbit — local-first, fast, and private. Check back in a future update."
      />
    </>
  )
}
