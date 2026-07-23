import { Bot, Search, Workflow, BarChart3, History, Info } from 'lucide-react'

import { appConfig } from '@/config/app'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

export { DashboardPage } from '@/pages/DashboardPage'
export { DocumentsPage } from '@/pages/DocumentsPage'
export { NotificationsPage } from '@/pages/NotificationsPage'
export { SettingsPage } from '@/pages/SettingsPage'

export function CopilotPage() {
  return (
    <PlaceholderPage
      title="AI Copilot"
      description="Natural language control of your desktop and workflows."
      icon={Bot}
      phase={3}
    />
  )
}

export function SearchPage() {
  return (
    <PlaceholderPage
      title="Semantic Search"
      description="Vector search across indexed documents."
      icon={Search}
      phase={3}
    />
  )
}

export function AutomationPage() {
  return (
    <PlaceholderPage
      title="Automation"
      description="Workflow automation with auditable execution history."
      icon={Workflow}
      phase={4}
    />
  )
}

export function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="Analytics"
      description="Historical metrics and system intelligence reports."
      icon={BarChart3}
      phase={4}
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

export function AboutPage() {
  return (
    <PlaceholderPage
      title="About Orbit"
      description={`${appConfig.tagline} — Phase 2 desktop integration.`}
      icon={Info}
    />
  )
}
