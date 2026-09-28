import { computed, reactive } from 'vue'

export type AnnouncementPriority = 'Normal' | 'High'

export interface HubAnnouncement {
  id: string
  title: string
  message: string
  priority: AnnouncementPriority
  link?: string | null
  publishFrom?: string
  publishTo?: string
}

const announcementsState = reactive({
  items: [] as HubAnnouncement[],
})

export const announcements = computed(() => announcementsState.items)

function asPriority(value: unknown): AnnouncementPriority {
  return value === 'High' ? 'High' : 'Normal'
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseAnnouncements(body: unknown): HubAnnouncement[] | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { announcements?: unknown }).announcements)) {
    return null
  }
  const items: HubAnnouncement[] = []
  for (const entry of (body as { announcements: unknown[] }).announcements) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const row = entry as Record<string, unknown>
    const id = asOptionalString(row.id)
    const title = asOptionalString(row.title)
    const message = typeof row.message === 'string' ? row.message : ''
    if (!id || !title) {
      continue
    }
    items.push({
      id,
      title,
      message,
      priority: asPriority(row.priority),
      link: asOptionalString(row.link) ?? null,
      publishFrom: asOptionalString(row.publishFrom),
      publishTo: asOptionalString(row.publishTo),
    })
  }
  return items
}

export function clearAnnouncements(): void {
  announcementsState.items = []
}

export async function fetchAnnouncements(accessToken: string | null): Promise<boolean> {
  if (!accessToken) {
    return false
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  try {
    const response = await fetch(`${apiBase}/announcements`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const body = await response.json().catch(() => null)
    const parsed = response.ok ? parseAnnouncements(body) : null
    if (!parsed) {
      return false
    }
    announcementsState.items = parsed
    return true
  } catch {
    return false
  }
}
