import { Bot, Workflow, History } from 'lucide-react'

import { PlaceholderPage } from '@/pages/PlaceholderPage'

export { DashboardPage } from '@/pages/DashboardPage'
export { DocumentsPage } from '@/pages/DocumentsPage'
export { NotificationsPage } from '@/pages/NotificationsPage'
export { SettingsPage } from '@/pages/SettingsPage'
export { AboutPage } from '@/pages/AboutPage'
export { SystemMonitorPage } from '@/pages/SystemMonitorPage'
/** Analytics route serves live system monitor (Phase 4A). */
export { SystemMonitorPage as AnalyticsPage } from '@/pages/SystemMonitorPage'

export function CopilotPage() {
  return (
    <PlaceholderPage
      title="AI Copilot"
      description="Natural language control of your desktop and workflows."
      icon={Bot}
    />
  )
}

export function AutomationPage() {
  return (
    <PlaceholderPage
      title="Automation"
      description="Workflow automation with auditable execution history."
      icon={Workflow}
    />
  )
}

export function HistoryPage() {
  return (
    <PlaceholderPage
      title="History"
      description="Timeline of actions, queries, and automation runs."
      icon={History}
    />
  )
}
