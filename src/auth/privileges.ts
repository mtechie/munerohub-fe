import { computed, reactive } from 'vue'

export const PRIVILEGES_KEY = 'munero.hub.privileges'

const SYNC_INTERVAL_KEY = 'munero.hub.privileges_sync_interval'
const SYNCED_AT_KEY = 'munero.hub.privileges_synced_at'
const LOCK_KEY = 'munero.hub.privileges_lock'
const LOCK_NAME = 'munero.hub.privileges-sync'
const DEFAULT_SYNC_INTERVAL_SECONDS = 600
const MIN_SYNC_INTERVAL_SECONDS = 30
const LOCK_TTL_MS = 15_000
const TAB_ID = crypto.randomUUID()

export interface Privilege {
  scope?: string
  description?: string
  privilegeName?: string
  privilegeTypeId?: string
  privilegeTypeName?: string
  privilegeIdentifier?: string
  metadata?: { url?: string }
}

const privilegesState = reactive({ items: [] as Privilege[] })

export const privileges = computed(() => privilegesState.items)

export type PrivilegesChangedListener = (items: Privilege[]) => void

const changeListeners = new Set<PrivilegesChangedListener>()

export function onPrivilegesChanged(listener: PrivilegesChangedListener): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

function emitPrivilegesChanged(items: Privilege[]): void {
  for (const listener of changeListeners) {
    listener(items)
  }
}

function privilegeFingerprint(items: Privilege[]): string {
  const normalized = items
    .map((item) => ({
      description: item.description ?? '',
      metadata: item.metadata ?? null,
      privilegeIdentifier: item.privilegeIdentifier ?? '',
      privilegeName: item.privilegeName ?? '',
      privilegeTypeId: item.privilegeTypeId ?? '',
      privilegeTypeName: item.privilegeTypeName ?? '',
      scope: item.scope ?? '',
    }))
    .sort((a, b) => a.privilegeIdentifier.localeCompare(b.privilegeIdentifier))
  return JSON.stringify(normalized)
}

function privilegesEqual(left: Privilege[], right: Privilege[]): boolean {
  return privilegeFingerprint(left) === privilegeFingerprint(right)
}

let syncTimer: number | null = null
let getAccessToken: (() => Promise<string | null>) | null = null
let visibilityHandler: (() => void) | null = null

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  localStorage.setItem(key, value)
}

function removeLocal(key: string): void {
  localStorage.removeItem(key)
}

function clampInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_SYNC_INTERVAL_SECONDS
  }
  return Math.max(MIN_SYNC_INTERVAL_SECONDS, Math.trunc(seconds))
}

function readSyncIntervalSeconds(): number {
  const stored = Number.parseInt(readLocal(SYNC_INTERVAL_KEY) || '', 10)
  return clampInterval(Number.isFinite(stored) ? stored : DEFAULT_SYNC_INTERVAL_SECONDS)
}

function writeSyncIntervalSeconds(seconds: number): void {
  writeLocal(SYNC_INTERVAL_KEY, String(clampInterval(seconds)))
}

function lastSyncedAt(): number {
  const value = Number.parseInt(readLocal(SYNCED_AT_KEY) || '', 10)
  return Number.isFinite(value) ? value : 0
}

function markSynced(): void {
  writeLocal(SYNCED_AT_KEY, String(Date.now()))
}

function persist(items: Privilege[]): boolean {
  if (privilegesEqual(privilegesState.items, items)) {
    return false
  }
  privilegesState.items = items
  writeLocal(PRIVILEGES_KEY, JSON.stringify(items))
  emitPrivilegesChanged(items)
  return true
}

function parsePrivilegesBody(body: unknown): { items: Privilege[]; syncIntervalSeconds?: number } | null {
  if (Array.isArray(body)) {
    return { items: body as Privilege[] }
  }
  if (body && typeof body === 'object' && Array.isArray((body as { privileges?: unknown }).privileges)) {
    const payload = body as { privileges: Privilege[]; syncIntervalSeconds?: unknown }
    const interval = Number(payload.syncIntervalSeconds)
    return {
      items: payload.privileges,
      syncIntervalSeconds: Number.isFinite(interval) ? clampInterval(interval) : undefined,
    }
  }
  return null
}

export function hasCachedPrivileges(): boolean {
  return readLocal(PRIVILEGES_KEY) !== null
}

export function hydratePrivileges(): void {
  const raw = readLocal(PRIVILEGES_KEY)
  if (raw === null) {
    persist([])
    return
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    persist(Array.isArray(parsed) ? (parsed as Privilege[]) : [])
  } catch {
    persist([])
  }
}

export function stopPrivilegeSync(): void {
  if (syncTimer !== null) {
    window.clearInterval(syncTimer)
    syncTimer = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  getAccessToken = null
}

export function clearPrivileges(): void {
  stopPrivilegeSync()
  persist([])
  removeLocal(PRIVILEGES_KEY)
  removeLocal(SYNC_INTERVAL_KEY)
  removeLocal(SYNCED_AT_KEY)
  removeLocal(LOCK_KEY)
}

export function hasPrivilege(identifier: string): boolean {
  return privilegesState.items.some((item) => item.privilegeIdentifier === identifier)
}

export async function fetchAndStorePrivileges(
  accessToken: string | null,
  options?: { failOpen?: boolean },
): Promise<boolean> {
  const failOpen = options?.failOpen !== false
  if (!accessToken) {
    if (failOpen) {
      persist([])
    }
    return false
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  try {
    const response = await fetch(`${apiBase}/privileges`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const body = await response.json().catch(() => null)
    const parsed = response.ok ? parsePrivilegesBody(body) : null
    if (!parsed) {
      if (failOpen) {
        persist([])
      }
      return false
    }
    persist(parsed.items)
    if (parsed.syncIntervalSeconds !== undefined) {
      writeSyncIntervalSeconds(parsed.syncIntervalSeconds)
    }
    markSynced()
    return true
  } catch {
    if (failOpen) {
      persist([])
    }
    return false
  }
}

function tryStorageLock(): boolean {
  const now = Date.now()
  try {
    const existing = readLocal(LOCK_KEY)
    if (existing) {
      const lock = JSON.parse(existing) as { tabId?: string; until?: number }
      if (lock.tabId && lock.tabId !== TAB_ID && typeof lock.until === 'number' && lock.until > now) {
        return false
      }
    }
    writeLocal(LOCK_KEY, JSON.stringify({ tabId: TAB_ID, until: now + LOCK_TTL_MS }))
    const confirmed = JSON.parse(readLocal(LOCK_KEY) || '{}') as { tabId?: string }
    return confirmed.tabId === TAB_ID
  } catch {
    return false
  }
}

async function withLeaderLock(task: () => Promise<void>): Promise<boolean> {
  const locks = navigator.locks
  if (locks && typeof locks.request === 'function') {
    let ran = false
    await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        return
      }
      ran = true
      await task()
    })
    return ran
  }

  if (!tryStorageLock()) {
    return false
  }
  await task()
  return true
}

function intervalElapsed(): boolean {
  return Date.now() - lastSyncedAt() >= readSyncIntervalSeconds() * 1000
}

async function syncTick(): Promise<void> {
  hydratePrivileges()
  if (!intervalElapsed()) {
    return
  }
  if (document.visibilityState !== 'visible') {
    return
  }
  if (!getAccessToken) {
    return
  }

  const token = await getAccessToken()
  await withLeaderLock(async () => {
    if (!intervalElapsed()) {
      return
    }
    await fetchAndStorePrivileges(token, { failOpen: false })
    scheduleSyncTimer()
  })
}

function scheduleSyncTimer(): void {
  if (syncTimer !== null) {
    window.clearInterval(syncTimer)
  }
  syncTimer = window.setInterval(() => {
    void syncTick()
  }, readSyncIntervalSeconds() * 1000)
}

export function startPrivilegeSync(tokenProvider: () => Promise<string | null>): void {
  getAccessToken = tokenProvider
  hydratePrivileges()
  if (syncTimer !== null) {
    return
  }
  scheduleSyncTimer()

  if (!visibilityHandler) {
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void syncTick()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }
}
