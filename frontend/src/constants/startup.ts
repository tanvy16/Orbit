/** Logo overlay visible duration (ms) — independent of service init. */
export const STARTUP_OVERLAY_DURATION_MS = 1_000

/** Dashboard shell stagger delay per region (ms). */
export const STARTUP_SHELL_STAGGER_MS = 60

export const startupShellMotion = {
  sidebar: {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.45, delay: STARTUP_SHELL_STAGGER_MS / 1000, ease: [0.4, 0, 0.2, 1] },
  },
  topNav: {
    initial: { opacity: 0, y: -6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, delay: (STARTUP_SHELL_STAGGER_MS * 2) / 1000, ease: [0.4, 0, 0.2, 1] },
  },
  main: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.48, delay: (STARTUP_SHELL_STAGGER_MS * 3) / 1000, ease: [0.4, 0, 0.2, 1] },
  },
} as const
