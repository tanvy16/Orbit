import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { StartupLogoOverlay } from '@/components/startup/StartupLogoOverlay'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { useStartupSequence } from '@/hooks/use-startup-sequence'
import { useStartupStore } from '@/stores/startup-store'

interface StartupTransitionProps {
  children: ReactNode
}

export function StartupTransition({ children }: StartupTransitionProps) {
  const reduceMotion = usePrefersReducedMotion()
  const phase = useStartupStore((s) => s.phase)
  useStartupSequence({ skipAnimations: reduceMotion })

  const showOverlay = !reduceMotion && phase === 'overlay'
  const animateShell = !reduceMotion && phase === 'overlay'

  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="h-full w-full"
        initial={false}
        animate={{
          opacity: animateShell ? [0.88, 1] : 1,
        }}
        transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>

      {showOverlay ? <StartupLogoOverlay /> : null}
    </div>
  )
}
