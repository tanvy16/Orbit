import orbitLogo from '@/assets/orbit-logo.png'
import { cn } from '@/utils/cn'

interface AnimatedLogoProps {
  className?: string
}

export function AnimatedLogo({ className }: AnimatedLogoProps) {
  return (
    <img
      src={orbitLogo}
      alt=""
      draggable={false}
      className={cn('h-10 w-auto max-w-[3rem] object-contain select-none', className)}
    />
  )
}
