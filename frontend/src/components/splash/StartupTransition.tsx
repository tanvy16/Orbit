import type { ReactNode } from 'react'
import { LayoutGroup, motion } from 'framer-motion'

import { SplashScreen } from '@/components/splash/SplashScreen'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { useStartupSequence } from '@/hooks/use-startup-sequence'
import { useStartupStore } from '@/stores/startup-store'

interface StartupTransitionProps {
  children: ReactNode
}

export function StartupTransition({ children }: StartupTransitionProps) {
  const reduceMotion = usePrefersReducedMotion()
  const phase = useStartupStore((s) => s.phase)
  const { statusMessage } = useStartupSequence({ skipAnimations: reduceMotion })

  const showSplash = !reduceMotion && phase !== 'complete'
  const shellVisible = phase === 'transition' || phase === 'complete'

  return (
    <LayoutGroup id="orbit-startup">
      <div className="relative h-full w-full overflow-hidden">
        <motion.div
          className="h-full w-full"
          initial={false}
          animate={{
            opacity: shellVisible ? 1 : 0,
          }}
          transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.12 }}
          style={{ pointerEvents: phase === 'complete' ? 'auto' : 'none' }}
        >
          {children}
        </motion.div>

        {showSplash ? (
          <SplashScreen
            statusMessage={statusMessage}
            phase={phase === 'transition' ? 'transition' : 'splash'}
          />
        ) : null}
      </div>
    </LayoutGroup>
  )
}
