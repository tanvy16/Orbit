import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { Sidebar } from '@/layouts/Sidebar'
import { TopNav } from '@/layouts/TopNav'
import { primaryNavigation, secondaryNavigation } from '@/config/navigation'

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

  return (
    <div className="flex h-full overflow-hidden bg-orbit-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav title={title} />
        <main className="flex-1 overflow-y-auto p-6">
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
        </main>
      </div>
    </div>
  )
}
