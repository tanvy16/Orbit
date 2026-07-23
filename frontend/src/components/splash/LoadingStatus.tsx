import { AnimatePresence, motion } from 'framer-motion'

interface LoadingStatusProps {
  message: string
  className?: string
}

export function LoadingStatus({ message, className }: LoadingStatusProps) {
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="text-sm font-medium tracking-wide text-violet-200/70"
          role="status"
          aria-live="polite"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
