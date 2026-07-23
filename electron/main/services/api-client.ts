const DEFAULT_API = 'http://127.0.0.1:18765'
const DEFAULT_TIMEOUT_MS = 60_000

export function getApiBaseUrl(): string {
  return process.env['ORBIT_API_BASE_URL'] ?? process.env['VITE_API_BASE_URL'] ?? DEFAULT_API
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: init?.method,
      body: init?.body,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`API ${path} failed (${response.status}): ${text}`)
    }
    if (response.status === 204) {
      return undefined as T
    }
    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API ${path} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
