import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

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
  return <RouterProvider router={appRouter} />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders />
    </QueryClientProvider>
  )
}
