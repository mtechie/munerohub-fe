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
  loaded: false,
})

export const announcements = computed(() => announcementsState.items)
export const announcementsLoaded = computed(() => announcementsState.loaded)

const SYNC_INTERVAL_MS = 10 * 60 * 1000

let syncTimer: number | null = null
let getAccessToken: (() => Promise<string | null>) | null = null
let visibilityHandler: (() => void) | null = null
let lastSyncedAt = 0

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
  stopAnnouncementSync()
  announcementsState.items = []
  announcementsState.loaded = false
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
      if (!announcementsState.loaded) {
        announcementsState.loaded = true
      }
      return false
    }
    announcementsState.items = parsed
    announcementsState.loaded = true
    lastSyncedAt = Date.now()
    return true
  } catch {
    if (!announcementsState.loaded) {
      announcementsState.loaded = true
    }
    return false
  }
}

function stopAnnouncementSync(): void {
  if (syncTimer !== null) {
    window.clearInterval(syncTimer)
    syncTimer = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  getAccessToken = null
  lastSyncedAt = 0
}

async function syncTick(): Promise<void> {
  if (document.visibilityState !== 'visible' || !getAccessToken) {
    return
  }
  if (lastSyncedAt > 0 && Date.now() - lastSyncedAt < SYNC_INTERVAL_MS) {
    return
  }
  const token = await getAccessToken()
  await fetchAnnouncements(token)
}

export function startAnnouncementSync(tokenProvider: () => Promise<string | null>): void {
  getAccessToken = tokenProvider
  if (syncTimer !== null) {
    return
  }
  syncTimer = window.setInterval(() => {
    void syncTick()
  }, SYNC_INTERVAL_MS)
  if (!visibilityHandler) {
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void syncTick()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }
}
