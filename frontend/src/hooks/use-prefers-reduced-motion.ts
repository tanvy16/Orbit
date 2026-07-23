import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** Respects OS reduced-motion and Framer Motion preference. */
export function usePrefersReducedMotion(): boolean {
  const framerReduced = useReducedMotion()
  const [mediaReduced, setMediaReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setMediaReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return framerReduced === true || mediaReduced
}
