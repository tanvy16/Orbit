import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { StartupTransition } from '@/components/splash'
import { useDesktopIndexEvents } from '@/hooks/use-desktop-index-events'
import { useThemeSync } from '@/hooks/use-theme-sync'
import { appRouter } from '@/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
})

function AppProviders() {
  useThemeSync()
  useDesktopIndexEvents()
  return (
    <StartupTransition>
      <RouterProvider router={appRouter} />
    </StartupTransition>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders />
    </QueryClientProvider>
  )
}
