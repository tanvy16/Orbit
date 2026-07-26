import { createHashRouter, Navigate } from 'react-router-dom'

import { AppShell } from '@/layouts/AppShell'
import { routes } from '@/config/app'
import {
  AboutPage,
  ActivityPage,
  AutomationPage,
  BatteryIntelligencePage,
  CopilotPage,
  CpuIntelligencePage,
  DashboardPage,
  DiagnosticsPage,
  DocumentsPage,
  GpuIntelligencePage,
  HistoryPage,
  KernelIntelligencePage,
  MemoryIntelligencePage,
  NetworkIntelligencePage,
  NotificationsPage,
  ProcessIntelligencePage,
  SettingsPage,
  StorageIntelligencePage,
  SystemIntelligencePage,
} from '@/pages/routes'
import { SearchPage } from '@/pages/SearchPage'

export const appRouter = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: routes.copilot.slice(1), element: <CopilotPage /> },
      { path: routes.search.slice(1), element: <SearchPage /> },
      { path: routes.documents.slice(1), element: <DocumentsPage /> },
      { path: routes.automation.slice(1), element: <AutomationPage /> },
      { path: routes.intelligence.slice(1), element: <SystemIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/cpu`, element: <CpuIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/memory`, element: <MemoryIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/storage`, element: <StorageIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/network`, element: <NetworkIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/gpu`, element: <GpuIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/battery`, element: <BatteryIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/kernel`, element: <KernelIntelligencePage /> },
      { path: `${routes.intelligence.slice(1)}/process/:pid`, element: <ProcessIntelligencePage /> },
      { path: 'analytics', element: <Navigate to={routes.intelligence} replace /> },
      { path: routes.notifications.slice(1), element: <NotificationsPage /> },
      { path: routes.activity.slice(1), element: <ActivityPage /> },
      { path: routes.diagnostics.slice(1), element: <DiagnosticsPage /> },
      { path: routes.history.slice(1), element: <HistoryPage /> },
      { path: routes.settings.slice(1), element: <SettingsPage /> },
      { path: routes.about.slice(1), element: <AboutPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
