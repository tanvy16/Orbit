import {
  BarChart3,
  Bell,
  Bot,
  FileText,
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
  { id: 'copilot', label: 'AI Copilot', path: routes.copilot, icon: Bot, badge: 'Phase 3', phase: 3 },
  { id: 'search', label: 'Semantic Search', path: routes.search, icon: Search },
  { id: 'documents', label: 'Documents', path: routes.documents, icon: FileText, badge: 'Phase 2', phase: 2 },
  { id: 'automation', label: 'Automation', path: routes.automation, icon: Workflow, badge: 'Phase 2', phase: 2 },
  { id: 'analytics', label: 'Analytics', path: routes.analytics, icon: BarChart3, badge: 'Phase 2', phase: 2 },
]

export const secondaryNavigation: NavigationItem[] = [
  { id: 'notifications', label: 'Notifications', path: routes.notifications, icon: Bell },
  { id: 'history', label: 'History', path: routes.history, icon: History },
  { id: 'settings', label: 'Settings', path: routes.settings, icon: Settings },
  { id: 'about', label: 'About', path: routes.about, icon: Info },
]
