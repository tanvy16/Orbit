import { apiFetch } from '@/services/http'

export interface ActivityItem {
  id: string
  kind: 'notification' | 'action' | 'task'
  title: string
  detail?: string
  level: 'success' | 'warning' | 'info' | 'error'
  category?: string
  timestamp?: string
  status?: string
  progress?: number
  read?: boolean
  source?: string
}

export interface ActivityFeedResponse {
  items: ActivityItem[]
  count: number
}

export function fetchActivityFeed(limit = 50): Promise<ActivityFeedResponse> {
  return apiFetch<ActivityFeedResponse>(`/api/v1/activity?limit=${limit}`)
}
