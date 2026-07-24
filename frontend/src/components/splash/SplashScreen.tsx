import { motion } from 'framer-motion'

import splashScreen from '@/assets/splash-screen.png'
import { LoadingStatus } from '@/components/splash/LoadingStatus'
import { SPLASH_BACKGROUND } from '@/components/splash/splash-theme'

interface SplashScreenProps {
  statusMessage: string
  phase: 'splash' | 'transition'
}

export function SplashScreen({ statusMessage, phase }: SplashScreenProps) {
  const isExiting = phase === 'transition'

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: SPLASH_BACKGROUND }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: isExiting ? 0.55 : 0.5, ease: 'easeOut' }}
      aria-hidden={isExiting}
    >
      <img
        src={splashScreen}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
      />

      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-12 sm:pb-14"
        animate={{
          opacity: isExiting ? 0 : 1,
          y: isExiting ? 8 : 0,
        }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      >
        {!isExiting ? (
          <LoadingStatus message={statusMessage} className="min-h-[1.5rem] text-center" />
        ) : null}
      </motion.div>
    </motion.div>
  )
}
