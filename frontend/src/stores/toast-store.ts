import { create } from 'zustand'

export type ToastLevel = 'success' | 'warning' | 'info' | 'error'

export interface ToastItem {
  id: string
  title: string
  message?: string
  level: ToastLevel
  durationMs?: number
}

interface ToastStore {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

let toastCounter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    const duration = toast.durationMs ?? (toast.level === 'error' ? 8000 : 5000)
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
    }, duration)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

export function toast(item: Omit<ToastItem, 'id'>) {
  useToastStore.getState().push(item)
}
