import { useEffect } from 'react'

import { STARTUP_OVERLAY_DURATION_MS } from '@/constants/startup'
import { useStartupStore } from '@/stores/startup-store'

interface UseStartupSequenceOptions {
  skipAnimations: boolean
}

/** Runs the brief logo overlay timer only — never blocks on backend readiness. */
export function useStartupSequence({ skipAnimations }: UseStartupSequenceOptions) {
  const setPhase = useStartupStore((s) => s.setPhase)

  useEffect(() => {
    if (skipAnimations) {
      setPhase('complete')
      return undefined
    }

    setPhase('overlay')
    const timer = setTimeout(() => {
      setPhase('complete')
    }, STARTUP_OVERLAY_DURATION_MS)

    return () => clearTimeout(timer)
  }, [skipAnimations, setPhase])
}
