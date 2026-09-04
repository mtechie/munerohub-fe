import type { Privilege, PrivilegeSection, SectionLayout, SectionPin } from '../auth/privileges'

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
  columnStart: number
  backgroundColor?: string
  icon?: string
  order: number
  pin?: SectionPin
  layout: SectionLayout
  showIcon: boolean
  showTags: boolean
  showDescription: boolean
  tiles: LaunchpadTile[]
}

export interface LaunchpadRow {
  row: number
  sections: LaunchpadSection[]
}

type WorkingSection = LaunchpadSection & { metadataRow: number }

interface RowBucket {
  occupied: boolean[]
  sections: WorkingSection[]
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function asPin(value: unknown): SectionPin | undefined {
  if (value === 'start' || value === 'end' || value === 'top' || value === 'bottom') {
    return value
  }
  return undefined
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return 12
  }
  return Math.min(12, Math.max(1, Math.round(weight)))
}

function asLayout(value: unknown): SectionLayout {
  return value === 'list' ? 'list' : 'grid'
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function resolveSection(privilege: Privilege, catalog: Map<string, PrivilegeSection>): PrivilegeSection | null {
  const sectionId = privilege.metadata?.sectionId
  const section = typeof sectionId === 'string' && sectionId.length > 0 ? catalog.get(sectionId) : undefined
  if (!section) {
    return null
  }
  return {
    id: section.id,
    title: section.title || section.id,
    row: Number(section.row) || 1,
    weight: clampWeight(Number(section.weight) || 12),
    backgroundColor: section.backgroundColor,
    icon: typeof section.icon === 'string' && section.icon.trim() ? section.icon.trim() : undefined,
    order: Number(section.order) || 1,
    pin: asPin(section.pin),
    layout: asLayout(section.layout),
    showIcon: asBool(section.showIcon, true),
    showTags: asBool(section.showTags, false),
    showDescription: asBool(section.showDescription, false),
  }
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
    icon: icon || undefined,
    order: Number(privilege.metadata?.order) || 0,
    tags: asTags(privilege.metadata?.tags),
  }
}

function byOrder(a: WorkingSection, b: WorkingSection): number {
  return a.order - b.order || a.title.localeCompare(b.title)
}

function emptyOccupied(): boolean[] {
  return Array.from({ length: 13 }, () => false)
}

function rangeFree(occupied: boolean[], start: number, weight: number): boolean {
  if (start < 1 || start + weight > 13) {
    return false
  }
  for (let column = start; column < start + weight; column += 1) {
    if (occupied[column]) {
      return false
    }
  }
  return true
}

function findFreeSpan(occupied: boolean[], weight: number, fromLeft: boolean): number | null {
  if (fromLeft) {
    for (let start = 1; start <= 13 - weight; start += 1) {
      if (rangeFree(occupied, start, weight)) {
        return start
      }
    }
  } else {
    for (let start = 13 - weight; start >= 1; start -= 1) {
      if (rangeFree(occupied, start, weight)) {
        return start
      }
    }
  }
  return null
}

function markOccupied(occupied: boolean[], start: number, weight: number): void {
  for (let column = start; column < start + weight; column += 1) {
    occupied[column] = true
  }
}

function getBucket(buckets: RowBucket[], index: number): RowBucket {
  while (buckets.length <= index) {
    buckets.push({ occupied: emptyOccupied(), sections: [] })
  }
  return buckets[index]
}

function placeOnBucket(bucket: RowBucket, section: WorkingSection, fromLeft: boolean): boolean {
  const columnStart = findFreeSpan(bucket.occupied, section.weight, fromLeft)
  if (columnStart === null) {
    return false
  }
  section.columnStart = columnStart
  markOccupied(bucket.occupied, columnStart, section.weight)
  bucket.sections.push(section)
  return true
}

function placePinnedThenFlow(sections: WorkingSection[]): RowBucket[] {
  const buckets: RowBucket[] = []
  const starts = sections.filter((section) => section.pin === 'start').sort(byOrder)
  const ends = sections.filter((section) => section.pin === 'end').sort(byOrder)
  const flow = sections
    .filter((section) => section.pin !== 'start' && section.pin !== 'end')
    .sort(byOrder)

  let startRow = 0
  for (const section of starts) {
    if (!placeOnBucket(getBucket(buckets, startRow), section, true)) {
      startRow += 1
      placeOnBucket(getBucket(buckets, startRow), section, true)
    }
  }

  let endRow = 0
  for (const section of ends) {
    if (!placeOnBucket(getBucket(buckets, endRow), section, false)) {
      endRow += 1
      placeOnBucket(getBucket(buckets, endRow), section, false)
    }
  }

  for (const section of flow) {
    let placed = false
    for (let index = 0; index < buckets.length; index += 1) {
      if (placeOnBucket(getBucket(buckets, index), section, true)) {
        placed = true
        break
      }
    }
    if (!placed) {
      placeOnBucket(getBucket(buckets, buckets.length), section, true)
    }
  }

  return buckets.filter((bucket) => bucket.sections.length > 0)
}

function packLeftWrapping(sections: WorkingSection[]): RowBucket[] {
  const buckets: RowBucket[] = []
  for (const section of [...sections].sort(byOrder)) {
    let placed = false
    for (let index = 0; index < buckets.length; index += 1) {
      if (placeOnBucket(getBucket(buckets, index), section, true)) {
        placed = true
        break
      }
    }
    if (!placed) {
      placeOnBucket(getBucket(buckets, buckets.length), section, true)
    }
  }
  return buckets.filter((bucket) => bucket.sections.length > 0)
}

function toLaunchpadRows(buckets: RowBucket[]): LaunchpadRow[] {
  return buckets.map((bucket, index) => {
    const row = index + 1
    const sections = bucket.sections
      .filter((section) => section.tiles.length > 0)
      .map((section) => {
        const { metadataRow: _metadataRow, ...placed } = section
        return { ...placed, row }
      })
      .sort((a, b) => a.columnStart - b.columnStart || a.order - b.order)

    if (sections.length === 0) {
      return { row, sections }
    }

    // If a visual row only contains one unpinned section, make it span the full 12-col width.
    // This avoids an overly narrow section (and single-column tile grids) when there are no
    // other sections in that row.
    if (sections.length === 1 && !sections[0].pin) {
      sections[0].columnStart = 1
      sections[0].weight = 12
    }
    return { row, sections }
  }).filter((row) => row.sections.length > 0)
}

function catalogById(catalog: PrivilegeSection[]): Map<string, PrivilegeSection> {
  const map = new Map<string, PrivilegeSection>()
  for (const section of catalog) {
    if (typeof section.id === 'string' && section.id.length > 0) {
      map.set(section.id, section)
    }
  }
  return map
}

export function collectLaunchpadRows(privileges: Privilege[], catalog: PrivilegeSection[] = []): LaunchpadRow[] {
  const sections = new Map<string, WorkingSection>()
  const byId = catalogById(catalog)

  for (const privilege of privileges) {
    const tile = toTile(privilege)
    if (!tile) {
      continue
    }
    const resolved = resolveSection(privilege, byId)
    if (!resolved) {
      continue
    }
    const existing = sections.get(resolved.id)
    if (existing) {
      existing.tiles.push(tile)
      continue
    }
    sections.set(resolved.id, {
      id: resolved.id,
      title: resolved.title,
      row: Number(resolved.row) || 1,
      metadataRow: Number(resolved.row) || 1,
      weight: clampWeight(resolved.weight),
      columnStart: 1,
      backgroundColor: resolved.backgroundColor,
      icon: resolved.icon,
      order: Number(resolved.order) || 1,
      pin: resolved.pin,
      layout: resolved.layout || 'grid',
      showIcon: resolved.showIcon !== false,
      showTags: Boolean(resolved.showTags),
      showDescription: Boolean(resolved.showDescription),
      tiles: [tile],
    })
  }

  for (const section of sections.values()) {
    section.tiles.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }

  const collected = [...sections.values()].filter((section) => section.tiles.length > 0)
  const top = collected.filter((section) => section.pin === 'top').sort(byOrder)
  const bottom = collected.filter((section) => section.pin === 'bottom').sort(byOrder)
  const middle = collected.filter((section) => section.pin !== 'top' && section.pin !== 'bottom')

  const middleByRow = new Map<number, WorkingSection[]>()
  for (const section of middle) {
    const list = middleByRow.get(section.metadataRow) ?? []
    list.push(section)
    middleByRow.set(section.metadataRow, list)
  }

  const buckets: RowBucket[] = [
    ...packLeftWrapping(top),
    ...[...middleByRow.entries()]
      .sort((a, b) => a[0] - b[0])
      .flatMap(([, list]) => placePinnedThenFlow(list)),
    ...packLeftWrapping(bottom),
  ]

  return toLaunchpadRows(buckets)
}
