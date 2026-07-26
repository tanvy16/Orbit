import { create } from 'zustand'

import type { StartupPhase } from '@/components/splash/types'

interface StartupStore {
  phase: StartupPhase
  setPhase: (phase: StartupPhase) => void
}

export const useStartupStore = create<StartupStore>((set) => ({
  phase: 'overlay',
  setPhase: (phase) => set({ phase }),
}))
