import orbitLogo from '@/assets/orbit-logo.png'

import { cn } from '@/utils/cn'

const sizeClasses = {
  xs: 'h-8 w-auto max-w-[2.5rem]',
  sm: 'h-10 w-auto max-w-[3rem]',
  md: 'h-14 w-auto max-w-[4rem]',
  lg: 'h-24 w-auto max-w-[12rem]',
  hero: 'h-40 w-auto max-w-[20rem] sm:h-48',
} as const

interface OrbitLogoProps {
  size?: keyof typeof sizeClasses
  className?: string
  alt?: string
}

/** Official Orbit branding asset — preserve aspect ratio, no crop or distortion. */
export function OrbitLogo({ size = 'md', className, alt = 'Orbit' }: OrbitLogoProps) {
  return (
    <img
      src={orbitLogo}
      alt={alt}
      draggable={false}
      className={cn('object-contain select-none', sizeClasses[size], className)}
    />
  )
}
