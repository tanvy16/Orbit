import { motion } from 'framer-motion'

import { cn } from '@/utils/cn'

interface CopilotTypingIndicatorProps {
  label?: string
  className?: string
}

export function CopilotTypingIndicator({ label, className }: CopilotTypingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} aria-live="polite">
      <div className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-orbit-foreground-muted/80"
            animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: index * 0.14,
            }}
          />
        ))}
      </div>
      {label ? <span className="text-xs text-orbit-foreground-muted">{label}</span> : null}
    </div>
  )
}
