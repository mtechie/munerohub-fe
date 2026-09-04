import { computed, reactive } from 'vue'

export const PRIVILEGES_KEY = 'munero.hub.privileges'
export const SECTIONS_KEY = 'munero.hub.sections'

const SYNC_INTERVAL_KEY = 'munero.hub.privileges_sync_interval'
const SYNCED_AT_KEY = 'munero.hub.privileges_synced_at'
const LOCK_KEY = 'munero.hub.privileges_lock'
const LOCK_NAME = 'munero.hub.privileges-sync'
const DEFAULT_SYNC_INTERVAL_SECONDS = 600
const MIN_SYNC_INTERVAL_SECONDS = 30
const LOCK_TTL_MS = 15_000
const TAB_ID = crypto.randomUUID()

export type SectionPin = 'start' | 'end' | 'top' | 'bottom'

export interface PrivilegeSection {
  id: string
  title: string
  row: number
  weight: number
  backgroundColor?: string
  icon?: string
  order: number
  pin?: SectionPin
}

export interface Privilege {
  scope?: string
  description?: string
  privilegeName?: string
  privilegeTypeId?: string
  privilegeTypeName?: string
  privilegeIdentifier?: string
  metadata?: {
    url?: string
    icon?: string
    order?: number
    tags?: string[]
    sectionId?: string
  }
}

const privilegesState = reactive({
  items: [] as Privilege[],
  sections: [] as PrivilegeSection[],
})

export const privileges = computed(() => privilegesState.items)
export const sections = computed(() => privilegesState.sections)

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

function sectionFingerprint(items: PrivilegeSection[]): string {
  const normalized = items
    .map((item) => ({
      backgroundColor: item.backgroundColor ?? '',
      icon: item.icon ?? '',
      id: item.id ?? '',
      order: item.order ?? 0,
      pin: item.pin ?? '',
      row: item.row ?? 0,
      title: item.title ?? '',
      weight: item.weight ?? 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify(normalized)
}

function sectionsEqual(left: PrivilegeSection[], right: PrivilegeSection[]): boolean {
  return sectionFingerprint(left) === sectionFingerprint(right)
}

function asSectionList(value: unknown): PrivilegeSection[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is PrivilegeSection => {
    return Boolean(item && typeof item === 'object' && typeof (item as PrivilegeSection).id === 'string')
  })
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

function persist(items: Privilege[], nextSections?: PrivilegeSection[]): boolean {
  const sectionList = nextSections ?? privilegesState.sections
  if (privilegesEqual(privilegesState.items, items) && sectionsEqual(privilegesState.sections, sectionList)) {
    return false
  }
  privilegesState.items = items
  privilegesState.sections = sectionList
  writeLocal(PRIVILEGES_KEY, JSON.stringify(items))
  writeLocal(SECTIONS_KEY, JSON.stringify(sectionList))
  emitPrivilegesChanged(items)
  return true
}

function parsePrivilegesBody(
  body: unknown,
): { items: Privilege[]; sections: PrivilegeSection[]; syncIntervalSeconds?: number } | null {
  if (Array.isArray(body)) {
    return { items: body as Privilege[], sections: [] }
  }
  if (body && typeof body === 'object' && Array.isArray((body as { privileges?: unknown }).privileges)) {
    const payload = body as { privileges: Privilege[]; sections?: unknown; syncIntervalSeconds?: unknown }
    const interval = Number(payload.syncIntervalSeconds)
    return {
      items: payload.privileges,
      sections: asSectionList(payload.sections),
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
  const sectionRaw = readLocal(SECTIONS_KEY)
  if (raw === null && sectionRaw === null) {
    persist([], [])
    return
  }

  try {
    const parsed = raw === null ? [] : (JSON.parse(raw) as unknown)
    const parsedSections = sectionRaw === null ? [] : (JSON.parse(sectionRaw) as unknown)
    persist(Array.isArray(parsed) ? (parsed as Privilege[]) : [], asSectionList(parsedSections))
  } catch {
    persist([], [])
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
  persist([], [])
  removeLocal(PRIVILEGES_KEY)
  removeLocal(SECTIONS_KEY)
  removeLocal(SYNC_INTERVAL_KEY)
  removeLocal(SYNCED_AT_KEY)
  removeLocal(LOCK_KEY)
}

export function hasPrivilege(identifier: string): boolean {
  return privilegesState.items.some((item) => item.privilegeIdentifier === identifier)
}

export function hasAnyPrivilege(...identifiers: string[]): boolean {
  return identifiers.some((identifier) => hasPrivilege(identifier))
}

export function hasAllPrivileges(...identifiers: string[]): boolean {
  return identifiers.length > 0 && identifiers.every((identifier) => hasPrivilege(identifier))
}

export function getPrivilege(identifier: string): Privilege | undefined {
  return privilegesState.items.find((item) => item.privilegeIdentifier === identifier)
}

export function listPrivilegesByType(typeId: string): Privilege[] {
  return privilegesState.items.filter((item) => item.privilegeTypeId === typeId)
}

export function privilegeAppUrl(identifier: string): string | undefined {
  const url = getPrivilege(identifier)?.metadata?.url
  return typeof url === 'string' && url.length > 0 ? url : undefined
}

export async function fetchAndStorePrivileges(
  accessToken: string | null,
  options?: { failOpen?: boolean },
): Promise<boolean> {
  const failOpen = options?.failOpen !== false
  if (!accessToken) {
    if (failOpen) {
      persist([], [])
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
        persist([], [])
      }
      return false
    }
    persist(parsed.items, parsed.sections)
    if (parsed.syncIntervalSeconds !== undefined) {
      writeSyncIntervalSeconds(parsed.syncIntervalSeconds)
    }
    markSynced()
    return true
  } catch {
    if (failOpen) {
      persist([], [])
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
