export const appConfig = {
  name: 'Orbit',
  tagline: 'Your desktop. Your intelligence.',
  version: '0.3.0',
  license: 'MIT',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:18765',
  storageKeys: {
    theme: 'orbit-theme',
    sidebarCollapsed: 'orbit-sidebar-collapsed',
  },
} as const

export const routes = {
  dashboard: '/',
  copilot: '/copilot',
  search: '/search',
  documents: '/documents',
  automation: '/automation',
  analytics: '/analytics',
  notifications: '/notifications',
  history: '/history',
  settings: '/settings',
  about: '/about',
} as const
