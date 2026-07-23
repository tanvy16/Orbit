import { useEffect, useState } from 'react'

import {
  STARTUP_MAX_DURATION_MS,
  STARTUP_MIN_DURATION_MS,
  STARTUP_READY_HOLD_MS,
  STARTUP_STATUS_INTERVAL_MS,
  STARTUP_STATUS_MESSAGES,
  STARTUP_TRANSITION_MS,
} from '@/constants/splash'
import { fetchHealth } from '@/services/api-client'
import { useStartupStore } from '@/stores/startup-store'

interface UseStartupSequenceOptions {
  skipAnimations: boolean
}

export function useStartupSequence({ skipAnimations }: UseStartupSequenceOptions) {
  const setPhase = useStartupStore((s) => s.setPhase)
  const [statusIndex, setStatusIndex] = useState(0)

  const statusMessage = STARTUP_STATUS_MESSAGES[statusIndex] ?? STARTUP_STATUS_MESSAGES[0]

  useEffect(() => {
    if (skipAnimations) {
      setPhase('complete')
      return undefined
    }

    let cancelled = false
    let readyTimer: ReturnType<typeof setTimeout> | undefined
    let completeTimer: ReturnType<typeof setTimeout> | undefined

    const healthReady = fetchHealth()
      .then(() => true)
      .catch(() => true)

    const minReady = new Promise<void>((resolve) => {
      setTimeout(resolve, STARTUP_MIN_DURATION_MS)
    })

    const maxReady = new Promise<void>((resolve) => {
      setTimeout(resolve, STARTUP_MAX_DURATION_MS)
    })

    const statusTimer = setInterval(() => {
      setStatusIndex((prev) => {
        if (prev >= STARTUP_STATUS_MESSAGES.length - 1) return prev
        return prev + 1
      })
    }, STARTUP_STATUS_INTERVAL_MS)

    void Promise.race([
      Promise.all([minReady, healthReady]).then(() => undefined),
      maxReady,
    ]).then(() => {
      if (cancelled) return

      clearInterval(statusTimer)
      setStatusIndex(STARTUP_STATUS_MESSAGES.length - 1)

      readyTimer = setTimeout(() => {
        if (cancelled) return
        setPhase('transition')

        completeTimer = setTimeout(() => {
          if (cancelled) return
          setPhase('complete')
        }, STARTUP_TRANSITION_MS)
      }, STARTUP_READY_HOLD_MS)
    })

    return () => {
      cancelled = true
      clearInterval(statusTimer)
      clearTimeout(readyTimer)
      clearTimeout(completeTimer)
    }
  }, [skipAnimations, setPhase])

  return { statusMessage }
}
