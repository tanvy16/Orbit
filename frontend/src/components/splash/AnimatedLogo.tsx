import { OrbitLogoMark } from '@/components/brand/OrbitLogoMark'
import { cn } from '@/utils/cn'

interface AnimatedLogoProps {
  className?: string
}

export function AnimatedLogo({ className }: AnimatedLogoProps) {
  return <OrbitLogoMark className={cn('h-10 w-10', className)} />
}
