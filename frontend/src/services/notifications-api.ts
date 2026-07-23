import type { BackgroundTaskDto, NotificationDto } from '@shared/types'

import { apiFetch } from '@/services/http'

export function fetchNotifications(unreadOnly = false) {
  return apiFetch<NotificationDto[]>(
    `/api/v1/notifications?unreadOnly=${unreadOnly ? 'true' : 'false'}`,
  )
}

export function fetchUnreadCount() {
  return apiFetch<{ count: number }>('/api/v1/notifications/unread-count')
}

export function markNotificationRead(id: number) {
  return apiFetch<{ ok: boolean }>(`/api/v1/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return apiFetch<{ ok: boolean }>('/api/v1/notifications/read-all', { method: 'POST' })
}

export function fetchTasks() {
  return apiFetch<BackgroundTaskDto[]>('/api/v1/tasks')
}

export function fetchActiveTasks() {
  return apiFetch<BackgroundTaskDto[]>('/api/v1/tasks/active')
}
