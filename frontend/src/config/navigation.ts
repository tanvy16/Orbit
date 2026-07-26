import {
  Activity,
  Bell,
  Bot,
  Brain,
  FileText,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  Search,
  Settings,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import { routes } from '@/config/app'

export interface NavigationItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  badge?: string
  phase?: number
}

export const primaryNavigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: routes.dashboard, icon: LayoutDashboard },
  { id: 'copilot', label: 'AI Copilot', path: routes.copilot, icon: Bot },
  { id: 'search', label: 'Semantic Search', path: routes.search, icon: Search },
  { id: 'documents', label: 'Documents', path: routes.documents, icon: FileText },
  { id: 'automation', label: 'Automation', path: routes.automation, icon: Workflow },
  { id: 'intelligence', label: 'System Intelligence', path: routes.intelligence, icon: Brain },
]

export const secondaryNavigation: NavigationItem[] = [
  { id: 'activity', label: 'Activity', path: routes.activity, icon: Activity },
  { id: 'diagnostics', label: 'Diagnostics', path: routes.diagnostics, icon: Gauge },
  { id: 'notifications', label: 'Notifications', path: routes.notifications, icon: Bell },
  { id: 'history', label: 'History', path: routes.history, icon: History },
  { id: 'settings', label: 'Settings', path: routes.settings, icon: Settings },
  { id: 'about', label: 'About', path: routes.about, icon: Info },
]
