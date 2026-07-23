import { useCallback, useEffect, useRef, useState } from 'react'

import { appConfig } from '@/config/app'
import type { SystemMetricsSnapshot } from '@shared/types'

import { fetchMonitoringSnapshot } from '@/services/monitoring-api'

function wsUrl(): string {
  const base = appConfig.apiBaseUrl.replace(/^http/i, 'ws')
  return `${base}/api/v1/monitoring/ws`
}

interface UseMonitoringStreamResult {
  data: SystemMetricsSnapshot | null
  isConnected: boolean
  isLoading: boolean
  error: string | null
  reconnect: () => void
}

export function useMonitoringStream(): UseMonitoringStreamResult {
  const [data, setData] = useState<SystemMetricsSnapshot | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await fetchMonitoringSnapshot()
      if (mountedRef.current) {
        setData(snap)
        setIsLoading(false)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics')
        setIsLoading(false)
      }
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    void loadSnapshot()

    try {
      const socket = new WebSocket(wsUrl())
      wsRef.current = socket

      socket.onopen = () => {
        if (!mountedRef.current) return
        setIsConnected(true)
        setError(null)
        setIsLoading(false)
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as SystemMetricsSnapshot
          if (mountedRef.current) {
            setData(payload)
            setIsLoading(false)
          }
        } catch {
          /* ignore malformed frames */
        }
      }

      socket.onerror = () => {
        if (!mountedRef.current) return
        setIsConnected(false)
        setError('Live monitoring connection lost')
      }

      socket.onclose = () => {
        if (!mountedRef.current) return
        setIsConnected(false)
        reconnectTimer.current = setTimeout(() => connect(), 2500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WebSocket unavailable')
      setIsLoading(false)
    }
  }, [loadSnapshot])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return {
    data,
    isConnected,
    isLoading,
    error,
    reconnect: connect,
  }
}
