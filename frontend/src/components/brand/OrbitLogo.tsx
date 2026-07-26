import { OrbitLogoMark } from '@/components/brand/OrbitLogoMark'

import { cn } from '@/utils/cn'

const sizeClasses = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-24 w-24',
  hero: 'h-40 w-40 sm:h-48 sm:w-48',
} as const

interface OrbitLogoProps {
  size?: keyof typeof sizeClasses
  className?: string
  alt?: string
}

/** Official Orbit branding — SVG vector mark, preserves aspect ratio. */
export function OrbitLogo({ size = 'md', className, alt = 'Orbit' }: OrbitLogoProps) {
  return (
    <OrbitLogoMark
      className={cn('object-contain select-none', sizeClasses[size], className)}
      aria-label={alt}
    />
  )
}
