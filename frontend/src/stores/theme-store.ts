import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { appConfig } from '@/config/app'
import type { ThemeMode } from '@shared/types'

interface ThemeState {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyThemeClass(resolved: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      resolved: 'dark',
      setMode: (mode) => {
        const resolved = resolveTheme(mode)
        applyThemeClass(resolved)
        set({ mode, resolved })
      },
    }),
    {
      name: appConfig.storageKeys.theme,
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.mode)
          applyThemeClass(resolved)
          state.resolved = resolved
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode, setMode } = useThemeStore.getState()
    if (mode === 'system') {
      setMode('system')
    }
  })
}
