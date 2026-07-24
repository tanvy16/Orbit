import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { AnimatedLogo } from '@/components/splash/AnimatedLogo'
import { Button } from '@/components/ui/Button'
import { primaryNavigation, secondaryNavigation } from '@/config/navigation'
import { appConfig } from '@/config/app'
import { useStartupStore } from '@/stores/startup-store'
import { useUiStore } from '@/stores/ui-store'
import { cn } from '@/utils/cn'

function NavSection({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-3 h-px bg-orbit-border/80" />
  return (
    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-orbit-foreground-muted/80">
      {title}
    </p>
  )
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const startupPhase = useStartupStore((s) => s.phase)
  const showBrandLogo = startupPhase === 'transition' || startupPhase === 'complete'

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 268 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full shrink-0 flex-col border-r border-orbit-border/80 bg-orbit-surface"
    >
      <div
        className={cn(
          'flex border-b border-orbit-border/80 px-3',
          collapsed ? 'h-16 flex-col items-center justify-center gap-1 py-2' : 'h-[4.25rem] items-center gap-3 px-4',
        )}
      >
        {showBrandLogo ? (
          <AnimatedLogo className={cn(collapsed && 'h-8 max-w-[2.5rem]')} />
        ) : (
          <div className={cn('shrink-0', collapsed ? 'h-8 w-8' : 'h-10 w-10')} aria-hidden />
        )}
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">{appConfig.name}</p>
            <p className="truncate text-[11px] text-orbit-foreground-muted">Desktop Intelligence</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-2.5 py-4">
        <div>
          <NavSection title="Workspace" collapsed={collapsed} />
          <ul className="space-y-0.5">
            {primaryNavigation.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-orbit-muted text-orbit-foreground shadow-sm'
                        : 'text-orbit-foreground-muted hover:bg-orbit-muted/60 hover:text-orbit-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-orbit-accent" />
                      ) : null}
                      <item.icon
                        className={cn(
                          'h-[1.125rem] w-[1.125rem] shrink-0 transition-colors',
                          isActive ? 'text-orbit-accent' : 'group-hover:text-orbit-foreground',
                        )}
                      />
                      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <NavSection title="System" collapsed={collapsed} />
          <ul className="space-y-0.5">
            {secondaryNavigation.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-orbit-muted text-orbit-foreground shadow-sm'
                        : 'text-orbit-foreground-muted hover:bg-orbit-muted/60 hover:text-orbit-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-orbit-accent" />
                      ) : null}
                      <item.icon
                        className={cn(
                          'h-[1.125rem] w-[1.125rem] shrink-0',
                          isActive ? 'text-orbit-accent' : 'group-hover:text-orbit-foreground',
                        )}
                      />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-orbit-border/80 p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-orbit-foreground-muted transition-colors hover:text-orbit-foreground"
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
