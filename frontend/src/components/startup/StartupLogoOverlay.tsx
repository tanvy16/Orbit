import { motion } from 'framer-motion'

import { OrbitLogoMark } from '@/components/brand/OrbitLogoMark'

export function StartupLogoOverlay() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-orbit-bg/72 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1, times: [0, 0.18, 0.78, 1], ease: 'easeInOut' }}
      aria-hidden
    >
      <motion.div
        className="flex flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.95, 1, 1, 0.98],
        }}
        transition={{ duration: 1, times: [0, 0.2, 0.75, 1], ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.div
          animate={{
            filter: [
              'drop-shadow(0 0 0px rgba(94,179,255,0))',
              'drop-shadow(0 0 18px rgba(94,179,255,0.45))',
              'drop-shadow(0 0 12px rgba(94,179,255,0.3))',
              'drop-shadow(0 0 0px rgba(94,179,255,0))',
            ],
          }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        >
          <OrbitLogoMark className="h-24 w-24 sm:h-28 sm:w-28" animate />
        </motion.div>

        <motion.p
          className="mt-5 text-xl font-semibold tracking-[0.22em] text-orbit-foreground"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] }}
          transition={{ duration: 1, times: [0, 0.25, 0.75, 1] }}
        >
          ORBIT
        </motion.p>
        <motion.p
          className="mt-1.5 text-xs font-medium tracking-[0.28em] text-orbit-foreground-muted uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1, times: [0, 0.3, 0.75, 1] }}
        >
          Desktop Intelligence
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
