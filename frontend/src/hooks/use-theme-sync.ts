import { useEffect } from 'react'

import { useThemeStore } from '@/stores/theme-store'

export function useThemeSync(): void {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  useEffect(() => {
    setMode(mode)
  }, [mode, setMode])
}
