import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'

import { useToastStore, type ToastLevel } from '@/stores/toast-store'
import { cn } from '@/utils/cn'

const icons: Record<ToastLevel, typeof Info> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: AlertCircle,
}

const styles: Record<ToastLevel, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-orbit-accent/30 bg-orbit-accent/10',
  error: 'border-orbit-danger/30 bg-orbit-danger/10',
}

const iconStyles: Record<ToastLevel, string> = {
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  info: 'text-orbit-accent',
  error: 'text-orbit-danger',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const Icon = icons[item.level]
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-xl',
                styles[item.level],
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconStyles[item.level])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-orbit-foreground">{item.title}</p>
                {item.message ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-orbit-foreground-muted">
                    {item.message}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-orbit-foreground-muted transition-colors hover:bg-orbit-muted/60 hover:text-orbit-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
