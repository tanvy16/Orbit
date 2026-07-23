import { createHashRouter, Navigate } from 'react-router-dom'

import { AppShell } from '@/layouts/AppShell'
import { routes } from '@/config/app'
import {
  AboutPage,
  AnalyticsPage,
  AutomationPage,
  CopilotPage,
  DashboardPage,
  DocumentsPage,
  HistoryPage,
  NotificationsPage,
  SearchPage,
  SettingsPage,
} from '@/pages/routes'

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
      { path: routes.analytics.slice(1), element: <AnalyticsPage /> },
      { path: routes.notifications.slice(1), element: <NotificationsPage /> },
      { path: routes.history.slice(1), element: <HistoryPage /> },
      { path: routes.settings.slice(1), element: <SettingsPage /> },
      { path: routes.about.slice(1), element: <AboutPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
