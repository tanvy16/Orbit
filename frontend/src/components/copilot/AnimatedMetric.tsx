import { motion } from 'framer-motion'

import { cn } from '@/utils/cn'

interface AnimatedMetricProps {
  value: number
  format?: (value: number) => string
  className?: string
}

export function AnimatedMetric({ value, format, className }: AnimatedMetricProps) {
  const display = format ? format(value) : value.toFixed(1)

  return (
    <motion.span
      key={display}
      initial={{ opacity: 0.55, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className={cn('inline-block tabular-nums', className)}
    >
      {display}
    </motion.span>
  )
}
