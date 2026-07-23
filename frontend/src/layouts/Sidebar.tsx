import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, CircleDot } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { primaryNavigation, secondaryNavigation } from '@/config/navigation'
import { appConfig } from '@/config/app'
import { useUiStore } from '@/stores/ui-store'
import { cn } from '@/utils/cn'

function NavSection({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 h-px bg-orbit-border" />
  return (
    <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-orbit-foreground-muted">
      {title}
    </p>
  )
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex h-full shrink-0 flex-col border-r border-orbit-border bg-orbit-surface"
    >
      <div className="flex h-14 items-center gap-3 border-b border-orbit-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orbit-accent text-orbit-accent-foreground">
          <CircleDot className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appConfig.name}</p>
            <p className="truncate text-[11px] text-orbit-foreground-muted">Desktop Intelligence</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        <div>
          <NavSection title="Workspace" collapsed={collapsed} />
          <ul className="space-y-1">
            {primaryNavigation.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-orbit-muted text-orbit-foreground'
                        : 'text-orbit-foreground-muted hover:bg-orbit-muted/70 hover:text-orbit-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? <Badge variant="muted">{item.badge}</Badge> : null}
                    </>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <NavSection title="System" collapsed={collapsed} />
          <ul className="space-y-1">
            {secondaryNavigation.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-orbit-muted text-orbit-foreground'
                        : 'text-orbit-foreground-muted hover:bg-orbit-muted/70 hover:text-orbit-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-orbit-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  )
}
