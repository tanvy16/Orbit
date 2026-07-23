import { Moon, Sun, Monitor } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useThemeStore } from '@/stores/theme-store'
import type { ThemeMode } from '@shared/types'
import { cn } from '@/utils/cn'

const modes: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore()

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-orbit-border/80 bg-orbit-surface/80 p-0.5 shadow-sm"
      role="group"
      aria-label="Theme"
    >
      {modes.map(({ mode: m, icon: Icon, label }) => (
        <Button
          key={m}
          variant={mode === m ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-8 w-8 px-0 transition-all duration-150',
            mode === m && 'shadow-sm',
          )}
          aria-label={`${label} theme`}
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  )
}
