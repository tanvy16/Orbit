import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useDesktopIndexEvents(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!window.orbit) return undefined

    const unsubProgress = window.orbit.onIndexProgress(() => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['document-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    })

    const unsubComplete = window.orbit.onIndexComplete(() => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['document-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    })

    const unsubWatcher = window.orbit.onWatcherChange(() => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubWatcher()
    }
  }, [queryClient])
}
