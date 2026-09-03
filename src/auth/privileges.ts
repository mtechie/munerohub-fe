import { computed, reactive } from 'vue'

export const PRIVILEGES_KEY = 'munero.hub.privileges'

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

function persist(items: Privilege[]): void {
  privilegesState.items = items
  writeLocal(PRIVILEGES_KEY, JSON.stringify(items))
}

export function hasCachedPrivileges(): boolean {
  return readLocal(PRIVILEGES_KEY) !== null
}

export function hydratePrivileges(): void {
  const raw = readLocal(PRIVILEGES_KEY)
  if (raw === null) {
    privilegesState.items = []
    return
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    privilegesState.items = Array.isArray(parsed) ? (parsed as Privilege[]) : []
  } catch {
    privilegesState.items = []
  }
}

export function clearPrivileges(): void {
  privilegesState.items = []
  removeLocal(PRIVILEGES_KEY)
}

export function hasPrivilege(identifier: string): boolean {
  return privilegesState.items.some((item) => item.privilegeIdentifier === identifier)
}

export async function fetchAndStorePrivileges(accessToken: string | null): Promise<void> {
  if (!accessToken) {
    persist([])
    return
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  try {
    const response = await fetch(`${apiBase}/privileges`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const body = await response.json().catch(() => null)
    persist(response.ok && Array.isArray(body) ? body : [])
  } catch {
    persist([])
  }
}
