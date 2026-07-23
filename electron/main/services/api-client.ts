const DEFAULT_API = 'http://127.0.0.1:18765'

export function getApiBaseUrl(): string {
  return process.env['ORBIT_API_BASE_URL'] ?? process.env['VITE_API_BASE_URL'] ?? DEFAULT_API
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${path} failed (${response.status}): ${text}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}
