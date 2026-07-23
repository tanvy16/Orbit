export type StatusLevel = 'healthy' | 'warning' | 'offline' | 'neutral'

/** Map API health strings to pill levels. */
export function healthLevelFromApiStatus(status: string | undefined): StatusLevel {
  if (!status) return 'neutral'
  const s = status.toLowerCase()
  if (s === 'ok' || s === 'healthy') return 'healthy'
  if (s === 'degraded' || s === 'warning') return 'warning'
  if (s === 'error' || s === 'offline') return 'offline'
  return 'neutral'
}
