import { motion } from 'framer-motion'

import orbitLogo from '@/assets/orbit-logo.png'
import { ORBIT_LOGO_LAYOUT_ID } from '@/constants/splash'

import type { AnimatedLogoVariant } from '@/components/splash/types'
import { cn } from '@/utils/cn'

const variantClasses: Record<AnimatedLogoVariant, string> = {
  splash: 'h-64 w-auto max-w-[22rem] sm:h-[17.5rem] sm:max-w-[26rem]',
  sidebar: 'h-10 w-auto max-w-[3rem]',
}

/** A few slow twinkles anchored around the splash logo (not game-like). */
const SPLASH_ACCENT_STARS = [
  { top: '8%', left: '22%', size: 2, delay: 0 },
  { top: '18%', right: '14%', size: 1.5, delay: 1.2 },
  { bottom: '22%', left: '12%', size: 2, delay: 2.4 },
  { bottom: '14%', right: '20%', size: 1.5, delay: 0.6 },
  { top: '42%', left: '6%', size: 1, delay: 1.8 },
  { top: '38%', right: '8%', size: 1, delay: 3.1 },
] as const

interface AnimatedLogoProps {
  variant: AnimatedLogoVariant
  layoutId?: boolean
  className?: string
  initialScale?: number
  showGlow?: boolean
}

function SplashAccentStars() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-[1]" aria-hidden>
      {SPLASH_ACCENT_STARS.map((star, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-white/90 shadow-[0_0_6px_rgba(186,200,255,0.8)]"
          style={{
            width: star.size,
            height: star.size,
            ...('top' in star ? { top: star.top } : {}),
            ...('bottom' in star ? { bottom: star.bottom } : {}),
            ...('left' in star ? { left: star.left } : {}),
            ...('right' in star ? { right: star.right } : {}),
          }}
          animate={{ opacity: [0.25, 0.85, 0.35] }}
          transition={{
            duration: 4.5 + index * 0.35,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: star.delay,
          }}
        />
      ))}
    </div>
  )
}

export function AnimatedLogo({
  variant,
  layoutId = false,
  className,
  initialScale = 0.9,
  showGlow = true,
}: AnimatedLogoProps) {
  const isSplash = variant === 'splash'

  const img = (
    <motion.img
      src={orbitLogo}
      alt=""
      draggable={false}
      layoutId={layoutId ? ORBIT_LOGO_LAYOUT_ID : undefined}
      initial={isSplash ? { scale: initialScale, opacity: 0 } : false}
      animate={isSplash ? { scale: 1, opacity: 1 } : undefined}
      transition={isSplash ? { duration: 0.85, ease: [0.22, 1, 0.36, 1] } : undefined}
      className={cn(
        'relative z-10 object-contain select-none',
        variantClasses[variant],
        isSplash &&
          'max-h-none [mask-image:radial-gradient(ellipse_88%_88%_at_50%_48%,#000_58%,transparent_100%)]',
        isSplash &&
          'drop-shadow-[0_0_28px_rgba(99,102,241,0.45)] drop-shadow-[0_0_64px_rgba(124,58,237,0.28)]',
        className,
      )}
    />
  )

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        isSplash && 'min-h-[16rem] min-w-[16rem] sm:min-h-[18rem] sm:min-w-[18rem]',
      )}
    >
      {showGlow && isSplash ? (
        <>
          <motion.div
            className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[80px] sm:h-72 sm:w-72"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.1, ease: 'easeOut' }}
            aria-hidden
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-[52%] rounded-full bg-violet-500/35 blur-3xl sm:h-52 sm:w-52"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.15, ease: 'easeOut' }}
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
            style={{
              background:
                'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(1,2,8,0) 45%, rgba(1,2,8,0.85) 100%)',
            }}
            aria-hidden
          />
          <SplashAccentStars />
        </>
      ) : null}
      {img}
    </div>
  )
}
