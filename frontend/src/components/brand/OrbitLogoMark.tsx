import { motion } from 'framer-motion'

import { cn } from '@/utils/cn'

interface OrbitLogoMarkProps {
  className?: string
  animate?: boolean
}

/** Vector Orbit mark — crisp at any DPI, no PNG stretching. */
export function OrbitLogoMark({ className, animate = false }: OrbitLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('aspect-square', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="orbit-o-gradient" x1="20" y1="10" x2="100" y2="110">
          <stop offset="0%" stopColor="#5eb3ff" />
          <stop offset="45%" stopColor="#2d6fd4" />
          <stop offset="100%" stopColor="#0b2d5c" />
        </linearGradient>
        <radialGradient id="orbit-star-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#b8dcff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2d6fd4" stopOpacity="0" />
        </radialGradient>
        <filter id="orbit-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="60" cy="60" r="54" fill="url(#orbit-o-gradient)" opacity="0.12" />

      <path
        d="M60 18c23.196 0 42 18.804 42 42s-18.804 42-42 42"
        stroke="url(#orbit-o-gradient)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 102c-23.196 0-42-18.804-42-42s18.804-42 42-42"
        stroke="#1a4a8a"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      <motion.g
        animate={
          animate
            ? {
                rotate: 360,
              }
            : undefined
        }
        transition={
          animate
            ? { duration: 12, repeat: Infinity, ease: 'linear' }
            : undefined
        }
        style={{ transformOrigin: '60px 60px' }}
      >
        <ellipse
          cx="60"
          cy="60"
          rx="46"
          ry="16"
          stroke="#7ec8ff"
          strokeWidth="1.5"
          strokeOpacity="0.55"
          transform="rotate(-24 60 60)"
        />
        <circle cx="98" cy="44" r="4.5" fill="#9ed4ff" filter="url(#orbit-soft-glow)" />
      </motion.g>

      <circle cx="60" cy="60" r="14" fill="url(#orbit-star-glow)" filter="url(#orbit-soft-glow)" />
      <path
        d="M60 52 L63.5 60 L72 60.5 L65.5 66 L67.5 74.5 L60 69.5 L52.5 74.5 L54.5 66 L48 60.5 L56.5 60 Z"
        fill="#ffffff"
      />
    </svg>
  )
}
