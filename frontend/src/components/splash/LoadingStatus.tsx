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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          className="text-sm font-medium tracking-[0.04em] text-white/50"
          role="status"
          aria-live="polite"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
