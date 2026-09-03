import type { Privilege, PrivilegeSection } from '../auth/privileges'

export interface LaunchpadTile {
  identifier: string
  name: string
  description: string
  url?: string
  icon?: string
  order: number
  tags: string[]
}

export interface LaunchpadSection {
  id: string
  title: string
  row: number
  weight: number
  backgroundColor?: string
  order: number
  variant: 'apps' | 'staging' | 'aside'
  tiles: LaunchpadTile[]
}

export interface LaunchpadRow {
  row: number
  sections: LaunchpadSection[]
}

export const APPS_SECTION: PrivilegeSection = {
  id: 'my-applications',
  title: 'My applications',
  row: 1,
  weight: 8,
  order: 1,
}

export const STAGING_SECTION: PrivilegeSection = {
  id: 'test-environments',
  title: 'Test Environments',
  row: 2,
  weight: 12,
  order: 1,
}

export const DEFAULT_TILE_ICONS: Record<string, string> = {
  GIFTLOV: 'hub-icon-giftlov',
  PXM: 'hub-icon-pxm',
}

export const ASIDE_SECTION: LaunchpadSection = {
  id: 'hub-aside',
  title: '',
  row: 1,
  weight: 4,
  order: 100,
  variant: 'aside',
  tiles: [],
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return 12
  }
  return Math.min(12, Math.max(1, Math.round(weight)))
}

function isStaging(tags: string[]): boolean {
  return tags.some((tag) => tag.toUpperCase() === 'STAGING')
}

function resolveSection(privilege: Privilege): PrivilegeSection {
  const tags = asTags(privilege.metadata?.tags)
  const section = privilege.metadata?.section
  if (section && typeof section.id === 'string' && section.id.length > 0) {
    return {
      id: section.id,
      title: section.title || section.id,
      row: Number(section.row) || (isStaging(tags) ? 2 : 1),
      weight: clampWeight(Number(section.weight) || (isStaging(tags) ? 12 : 8)),
      backgroundColor: section.backgroundColor,
      order: Number(section.order) || 1,
    }
  }
  return isStaging(tags) ? { ...STAGING_SECTION } : { ...APPS_SECTION }
}

function toTile(privilege: Privilege): LaunchpadTile | null {
  const identifier = privilege.privilegeIdentifier
  const name = privilege.privilegeName
  if (!identifier || !name) {
    return null
  }
  const url = privilege.metadata?.url
  const icon = typeof privilege.metadata?.icon === 'string' ? privilege.metadata.icon.trim() : ''
  return {
    identifier,
    name,
    description: privilege.description || '',
    url: typeof url === 'string' && url.length > 0 ? url : undefined,
    icon: icon || DEFAULT_TILE_ICONS[identifier],
    order: Number(privilege.metadata?.order) || 0,
    tags: asTags(privilege.metadata?.tags),
  }
}

function sectionVariant(section: PrivilegeSection): LaunchpadSection['variant'] {
  return section.id === STAGING_SECTION.id ? 'staging' : 'apps'
}

export function collectLaunchpadRows(privileges: Privilege[]): LaunchpadRow[] {
  const sections = new Map<string, LaunchpadSection>()

  for (const privilege of privileges) {
    const tile = toTile(privilege)
    if (!tile) {
      continue
    }
    const resolved = resolveSection(privilege)
    const existing = sections.get(resolved.id)
    if (existing) {
      existing.tiles.push(tile)
      continue
    }
    sections.set(resolved.id, {
      ...resolved,
      weight: clampWeight(resolved.weight),
      variant: 'apps',
      tiles: [tile],
    })
  }

  for (const section of sections.values()) {
    section.tiles.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    section.variant = sectionVariant(section)
  }

  const byRow = new Map<number, LaunchpadSection[]>()
  for (const section of sections.values()) {
    const list = byRow.get(section.row) ?? []
    list.push(section)
    byRow.set(section.row, list)
  }

  const row1 = byRow.get(1) ?? []
  if (!row1.some((section) => section.id === ASIDE_SECTION.id)) {
    row1.push({ ...ASIDE_SECTION, tiles: [] })
  }
  byRow.set(1, row1)

  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, list]) => ({
      row,
      sections: list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
}
