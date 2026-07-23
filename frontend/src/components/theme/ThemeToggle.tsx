import { Moon, Sun, Monitor } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useThemeStore } from '@/stores/theme-store'
import type { ThemeMode } from '@shared/types'

const modes: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-orbit-border bg-orbit-muted/50 p-1">
      {modes.map(({ mode: m, icon: Icon, label }) => (
        <Button
          key={m}
          variant={mode === m ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2"
          aria-label={`${label} theme`}
          onClick={() => setMode(m)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  )
}
