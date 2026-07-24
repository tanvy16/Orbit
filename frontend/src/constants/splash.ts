export const STARTUP_STATUS_MESSAGES = [
  'Connecting Local Backend…',
  'Preparing Semantic Index…',
  'Loading AI Copilot…',
  'Starting Desktop Intelligence…',
  'Ready.',
] as const

/** Minimum time on splash so states feel natural (ms). */
export const STARTUP_MIN_DURATION_MS = 5_500

/** Maximum wait before proceeding regardless of backend (ms). */
export const STARTUP_MAX_DURATION_MS = 7_000

/** Interval between status message advances (ms). */
export const STARTUP_STATUS_INTERVAL_MS = 820

/** Pause on "Ready." before transition (ms). */
export const STARTUP_READY_HOLD_MS = 420

/** Duration of splash fade + shell reveal (ms). */
export const STARTUP_TRANSITION_MS = 650
