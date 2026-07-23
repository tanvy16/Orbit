/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./frontend/index.html', './frontend/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        orbit: {
          bg: 'hsl(var(--orbit-bg))',
          surface: 'hsl(var(--orbit-surface))',
          'surface-elevated': 'hsl(var(--orbit-surface-elevated))',
          border: 'hsl(var(--orbit-border))',
          muted: 'hsl(var(--orbit-muted))',
          foreground: 'hsl(var(--orbit-foreground))',
          'foreground-muted': 'hsl(var(--orbit-foreground-muted))',
          accent: 'hsl(var(--orbit-accent))',
          'accent-foreground': 'hsl(var(--orbit-accent-foreground))',
          ring: 'hsl(var(--orbit-ring))',
          danger: 'hsl(var(--orbit-danger))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 2px hsl(0 0% 0% / 0.24), 0 8px 24px hsl(0 0% 0% / 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
