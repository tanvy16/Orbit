import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { startupShellMotion } from '@/constants/startup'
import { Sidebar } from '@/layouts/Sidebar'
import { TopNav } from '@/layouts/TopNav'
import { primaryNavigation, secondaryNavigation } from '@/config/navigation'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { useStartupStore } from '@/stores/startup-store'

function resolveTitle(pathname: string): string {
  const all = [...primaryNavigation, ...secondaryNavigation]
  const match = all.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )
  return match?.label ?? 'Orbit'
}

export function AppShell() {
  const location = useLocation()
  const title = resolveTitle(location.pathname)
  const reduceMotion = usePrefersReducedMotion()
  const phase = useStartupStore((s) => s.phase)
  const shellIntro = !reduceMotion && phase === 'overlay'

  return (
    <div className="flex h-full overflow-hidden bg-orbit-bg">
      <motion.div {...(shellIntro ? startupShellMotion.sidebar : { initial: false, animate: {} })}>
        <Sidebar />
      </motion.div>
      <div className="flex min-w-0 flex-1 flex-col">
        <motion.div {...(shellIntro ? startupShellMotion.topNav : { initial: false, animate: {} })}>
          <TopNav title={title} />
        </motion.div>
        <motion.main
          className="flex-1 overflow-y-auto p-6"
          {...(shellIntro ? startupShellMotion.main : { initial: false, animate: {} })}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="mx-auto max-w-6xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>
    </div>
  )
}
