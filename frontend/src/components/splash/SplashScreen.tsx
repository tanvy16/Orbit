import { motion } from 'framer-motion'

import { AnimatedLogo } from '@/components/splash/AnimatedLogo'
import { LoadingStatus } from '@/components/splash/LoadingStatus'
import { ParticleBackground } from '@/components/splash/ParticleBackground'
import { appConfig } from '@/config/app'
import { cn } from '@/utils/cn'

interface SplashScreenProps {
  statusMessage: string
  phase: 'splash' | 'transition'
  reduceMotion: boolean
}

export function SplashScreen({ statusMessage, phase, reduceMotion }: SplashScreenProps) {
  const isExiting = phase === 'transition'

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: isExiting ? 0.55 : 0.5, ease: 'easeOut' }}
      aria-hidden={isExiting}
    >
      <ParticleBackground disabled={reduceMotion} />

      <motion.div
        className="relative z-10 flex flex-col items-center px-6 text-center"
        animate={{
          opacity: isExiting ? 0 : 1,
          scale: isExiting ? 0.92 : 1,
        }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      >
        {!isExiting ? (
          <>
            <AnimatedLogo variant="splash" layoutId showGlow />
            <motion.h1
              className={cn(
                'mt-10 text-2xl font-semibold tracking-[0.35em] text-white/95 sm:mt-12 sm:text-3xl',
              )}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              {appConfig.name.toUpperCase()}
            </motion.h1>
            <motion.p
              className="mt-3 max-w-sm text-sm tracking-wide text-violet-200/60 sm:text-base"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              Your Desktop. Your Intelligence.
            </motion.p>
            <LoadingStatus message={statusMessage} className="mt-10 min-h-[1.5rem]" />
          </>
        ) : null}
      </motion.div>
    </motion.div>
  )
}
