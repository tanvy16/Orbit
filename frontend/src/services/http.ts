import { appConfig } from '@/config/app'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const DEFAULT_TIMEOUT_MS = 30_000
const SEARCH_TIMEOUT_MS = 90_000

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutOverride = init?.timeoutMs
  const timeoutMs =
    timeoutOverride ?? (path.includes('/search/semantic') ? SEARCH_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
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
      throw new ApiError(text || `Request failed (${response.status})`, response.status)
    }
    if (response.status === 204) {
      return undefined as T
    }
    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
