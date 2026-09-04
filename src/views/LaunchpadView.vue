<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { authBusy, isAuthenticated, logout, user } from '../auth/authStore'
import { getPrivilege, onPrivilegesChanged, privileges, sections } from '../auth/privileges'
import {
  collectLaunchpadRows,
  type LaunchpadRow,
  type LaunchpadSection,
  type LaunchpadTile,
} from '../launchpad/sections'
import '../launchpad/icons.css'

interface SearchHit {
  identifier: string
  name: string
  type: string
  icon?: string
  iconColor?: string
  textColor?: string
  url?: string
}

const givenName = computed(() => {
  const profile = user.value
  return profile?.givenName || profile?.name?.split(/\s+/)[0] || 'there'
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${givenName.value}`
})

const displayName = computed(() => user.value?.givenName || user.value?.name || 'Signed in')
const displayEmail = computed(() => user.value?.email || '')
const avatarLetter = computed(() => (givenName.value[0] || 'M').toUpperCase())

const layoutRows = ref<LaunchpadRow[]>([])
const layoutReady = ref(false)
const privilegesUpdated = ref(false)

const searchQuery = ref('')
const searchOpen = ref(false)
const highlightedIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)

function applyLayout(): void {
  layoutRows.value = collectLaunchpadRows(privileges.value, sections.value)
  layoutReady.value = true
  privilegesUpdated.value = false
}

onMounted(() => {
  applyLayout()
  const stop = onPrivilegesChanged(() => {
    if (authBusy.value || !isAuthenticated.value) {
      return
    }
    if (!layoutReady.value || layoutRows.value.length === 0) {
      applyLayout()
      return
    }
    privilegesUpdated.value = true
  })
  const onKey = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      searchInput.value?.focus()
    }
  }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => {
    stop()
    window.removeEventListener('keydown', onKey)
  })
})

const navItems = computed(() => {
  const fromLayout = layoutRows.value.flatMap((row) =>
    row.sections
      .filter((section) => section.tiles.length > 0)
      .map((section) => ({
        id: section.id,
        label: section.title,
        href: `#${section.id}`,
        icon: section.icon,
        active: false,
      })),
  )
  return [
    { id: 'home', label: 'Home', href: '#top', icon: 'hub-icon-home', active: true },
    ...fromLayout,
  ]
})

const visibleResources = computed((): SearchHit[] => {
  const hits: SearchHit[] = []
  for (const row of layoutRows.value) {
    for (const section of row.sections) {
      for (const tile of section.tiles) {
        const privilege = getPrivilege(tile.identifier)
        hits.push({
          identifier: tile.identifier,
          name: tile.name,
          type: privilege?.privilegeTypeName || privilege?.privilegeTypeId || '',
          icon: tile.icon,
          iconColor: tile.iconColor,
          textColor: tile.textColor,
          url: tile.url,
        })
      }
    }
  }
  return hits
})

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return visibleResources.value
  }
  return visibleResources.value.filter((hit) => {
    return (
      hit.name.toLowerCase().includes(query) ||
      hit.type.toLowerCase().includes(query) ||
      hit.identifier.toLowerCase().includes(query)
    )
  })
})

watch(searchResults, () => {
  highlightedIndex.value = 0
})

watch(highlightedIndex, (index) => {
  if (!searchOpen.value) {
    return
  }
  document.getElementById(activeOptionId(index))?.scrollIntoView({ block: 'nearest' })
})

function tilesOf(section: LaunchpadSection): LaunchpadTile[] {
  return section.tiles
}

function tileHref(tile: LaunchpadTile): string | undefined {
  return tile.url
}

function letterMark(name: string): string {
  const letter = name.trim().charAt(0)
  return letter ? letter.toUpperCase() : '?'
}

function tileChrome(tile: { iconColor?: string; textColor?: string }): Record<string, string> {
  const style: Record<string, string> = {}
  if (tile.iconColor) {
    style['--tile-icon-color'] = tile.iconColor
  }
  if (tile.textColor) {
    style['--tile-text-color'] = tile.textColor
  }
  return style
}

function openSearch(): void {
  searchOpen.value = true
  highlightedIndex.value = 0
}

function closeSearch(): void {
  searchOpen.value = false
}

function moveHighlight(delta: number): void {
  const count = searchResults.value.length
  if (count === 0) {
    return
  }
  highlightedIndex.value = (highlightedIndex.value + delta + count) % count
}

function openResource(hit: SearchHit | undefined): void {
  if (!hit?.url) {
    return
  }
  window.open(hit.url, '_blank', 'noopener,noreferrer')
  searchQuery.value = ''
  closeSearch()
  searchInput.value?.blur()
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!searchOpen.value) {
      openSearch()
      return
    }
    moveHighlight(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!searchOpen.value) {
      openSearch()
      return
    }
    moveHighlight(-1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (!searchOpen.value) {
      openSearch()
    }
    openResource(searchResults.value[highlightedIndex.value])
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
    searchInput.value?.blur()
  }
}

function activeOptionId(index: number): string {
  return `search-option-${index}`
}

async function signOut(): Promise<void> {
  await logout()
}
</script>

<template>
  <div id="top" class="launchpad">
    <aside class="sidebar" aria-label="Hub navigation">
      <div class="brand">
        <img class="brand-mark" src="/favicon.svg" alt="" />
        <p class="brand-name">Munero Hub</p>
      </div>

      <nav class="nav">
        <a
          v-for="item in navItems"
          :key="item.id"
          :href="item.href"
          class="nav-item"
          :class="{ active: item.active }"
        >
          <span class="nav-icon" :class="item.icon" aria-hidden="true"></span>
          {{ item.label }}
        </a>
      </nav>

      <div class="sidebar-foot">
        <div class="m365">
          <span class="m365-mark" aria-hidden="true"></span>
          <span>
            Microsoft 365
            <small>Connected</small>
          </span>
        </div>
        <div class="user-chip">
          <span class="avatar" aria-hidden="true">{{ avatarLetter }}</span>
          <span class="user-meta">
            <strong>{{ displayName }}</strong>
            <small v-if="displayEmail">{{ displayEmail }}</small>
          </span>
          <button type="button" class="sign-out" :disabled="authBusy" @click="signOut">Sign out</button>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="mobile-brand">
          <img class="brand-mark" src="/favicon.svg" alt="" />
          <p class="brand-name">Munero Hub</p>
        </div>
        <div class="search">
          <span class="search-icon" aria-hidden="true"></span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            role="combobox"
            placeholder="Search apps, policies and resources"
            autocomplete="off"
            aria-autocomplete="list"
            :aria-expanded="searchOpen"
            aria-controls="search-listbox"
            :aria-activedescendant="searchOpen && searchResults.length ? activeOptionId(highlightedIndex) : undefined"
            @focus="openSearch"
            @input="openSearch"
            @keydown="onSearchKeydown"
            @blur="closeSearch"
          />
          <kbd>⌘ K</kbd>
          <ul
            v-if="searchOpen"
            id="search-listbox"
            class="search-results"
            role="listbox"
            @mousedown.prevent
          >
            <li v-if="!searchResults.length" class="search-empty" role="presentation">No matches</li>
            <li
              v-for="(hit, index) in searchResults"
              :id="activeOptionId(index)"
              :key="hit.identifier"
              role="option"
              class="search-hit"
              :class="{ active: index === highlightedIndex }"
              :style="tileChrome(hit)"
              :aria-selected="index === highlightedIndex"
              @mouseenter="highlightedIndex = index"
              @click="openResource(hit)"
            >
              <span v-if="hit.icon" class="tile-icon search-hit-icon" :class="hit.icon" aria-hidden="true"></span>
              <span v-else class="tile-icon search-hit-icon letter-mark" aria-hidden="true">{{ letterMark(hit.name) }}</span>
              <span class="search-hit-name">{{ hit.name }}</span>
              <span class="search-hit-type">{{ hit.type }}</span>
            </li>
          </ul>
        </div>
        <div class="top-actions">
          <button type="button" class="bell" aria-label="Notifications">
            <span class="bell-icon" aria-hidden="true"></span>
            <span class="badge">3</span>
          </button>
          <span class="avatar header-avatar" aria-hidden="true">{{ avatarLetter }}</span>
          <button type="button" class="sign-out mobile-sign-out" :disabled="authBusy" @click="signOut">Sign out</button>
        </div>
      </header>

      <div class="content">
        <section class="greeting">
          <h1>{{ greeting }} 👋</h1>
          <p>Here's your personalized hub. Access the tools, updates, and resources you need.</p>
        </section>

        <div v-for="row in layoutRows" :key="row.row" class="grid-row">
          <template v-for="section in row.sections" :key="section.id">
            <section
              v-if="tilesOf(section).length"
              :id="section.id"
              class="section"
              :class="`layout-${section.layout}`"
              :style="{
                '--weight': String(section.weight),
                '--col-start': String(section.columnStart),
                backgroundColor: section.backgroundColor || undefined,
              }"
            >
            <header class="section-head">
              <h2>
                <span v-if="section.icon" class="section-icon" :class="section.icon" aria-hidden="true"></span>
                {{ section.title }}
              </h2>
              <a :href="`#${section.id}`">View all →</a>
            </header>

            <div v-if="section.layout === 'list'" class="tile-list">
              <component
                :is="tileHref(tile) ? 'a' : 'div'"
                v-for="tile in tilesOf(section)"
                :key="tile.identifier"
                class="list-item"
                :style="tileChrome(tile)"
                v-bind="tileHref(tile) ? { href: tileHref(tile), target: '_blank', rel: 'noreferrer' } : {}"
              >
                <span v-if="section.showIcon && tile.icon" class="tile-icon" :class="tile.icon" aria-hidden="true"></span>
                <span v-else-if="section.showIcon" class="tile-icon letter-mark" aria-hidden="true">{{ letterMark(tile.name) }}</span>
                <span class="list-copy">
                  <strong>{{ tile.name }}</strong>
                  <small v-if="section.showDescription && tile.description">{{ tile.description }}</small>
                </span>
                <span v-if="section.showTags && tile.tags.length" class="tile-tags">
                  <span v-for="tag in tile.tags" :key="tag" class="tile-tag">{{ tag }}</span>
                </span>
              </component>
            </div>

            <div v-else class="tile-grid" :class="{ 'tile-grid-detail': section.showDescription }">
              <component
                :is="tileHref(tile) ? 'a' : 'div'"
                v-for="tile in tilesOf(section)"
                :key="tile.identifier"
                class="tile"
                :class="{ 'tile-detail': section.showDescription }"
                :style="tileChrome(tile)"
                v-bind="tileHref(tile) ? { href: tileHref(tile), target: '_blank', rel: 'noreferrer' } : {}"
              >
                <span v-if="section.showTags && tile.tags.length" class="tile-tags">
                  <span v-for="tag in tile.tags" :key="tag" class="tile-tag">{{ tag }}</span>
                </span>
                <span v-if="section.showIcon && tile.icon" class="tile-icon" :class="tile.icon" aria-hidden="true"></span>
                <span v-else-if="section.showIcon" class="tile-icon letter-mark" aria-hidden="true">{{ letterMark(tile.name) }}</span>
                <strong>{{ tile.name }}</strong>
                <small v-if="section.showDescription && tile.description">{{ tile.description }}</small>
              </component>
            </div>
          </section>
          </template>
        </div>
      </div>
    </div>

    <div v-if="privilegesUpdated && !authBusy && isAuthenticated" class="privilege-gate" role="dialog" aria-modal="true" aria-labelledby="privilege-gate-title">
      <div class="privilege-gate-card">
        <p id="privilege-gate-title">Your privileges were updated</p>
        <button type="button" @click="applyLayout">Refresh Now</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.launchpad {
  min-height: 100vh;
  min-width: 0;
  display: grid;
  grid-template-columns: 16.5rem minmax(0, 1fr);
  background: #f4f6f8;
  color: #1a1f26;
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 1.35rem 1rem 1.1rem;
  background: #fff;
  border-right: 1px solid #e7ecf1;
}

.brand,
.mobile-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0 0.65rem 1.4rem;
}

.brand-mark {
  width: 2.35rem;
  height: 2.25rem;
}

.brand-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.62rem 0.8rem;
  border-radius: 0.65rem;
  color: inherit;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 550;
}

.nav-item:hover {
  background: #f3f5f7;
}

.nav-item.active {
  background: #fff1e6;
  box-shadow: inset 3px 0 0 #f47b20;
}

.nav-icon,
.search-icon,
.bell-icon,
.m365-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 1.15rem;
}

.search-icon,
.bell-icon,
.m365-mark {
  background: currentColor;
  -webkit-mask: center / contain no-repeat;
  mask: center / contain no-repeat;
}

.nav-icon[class*='hub-icon-'] {
  background: transparent;
  color: inherit;
}

.nav-icon[class*='hub-icon-']::before {
  width: 1.15rem;
  height: 1.15rem;
}

.sidebar-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-top: 1rem;
}

.m365 {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid #e7ecf1;
  border-radius: 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
}

.m365 small {
  display: block;
  margin-top: 0.1rem;
  color: #1b7a3a;
  font-weight: 650;
}

.m365-mark {
  width: 1.15rem;
  height: 1.15rem;
  background:
    linear-gradient(#f35325 50%, #81bc06 50%) 0 0 / 50% 100% no-repeat,
    linear-gradient(#05a6f0 50%, #ffba08 50%) 100% 0 / 50% 100% no-repeat;
  -webkit-mask: none;
  mask: none;
  border-radius: 0.15rem;
}

.m365-mark::after {
  content: '';
}

.user-chip {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'avatar meta'
    'out out';
  gap: 0.35rem 0.65rem;
  align-items: center;
}

.user-meta {
  grid-area: meta;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-meta strong {
  font-size: 0.88rem;
}

.user-meta small {
  color: #6b7380;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sign-out {
  grid-area: out;
  justify-self: start;
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  color: #6b7380;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.sign-out:hover {
  color: #1a1f26;
}

.sign-out:disabled {
  opacity: 0.55;
  cursor: default;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #f7d7b8;
  color: #8a4b16;
  font-size: 0.8rem;
  font-weight: 700;
}

.main {
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.6rem 0.4rem;
}

.mobile-brand {
  display: none;
}

.search {
  position: relative;
  z-index: 6;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 38rem;
  margin: 0 auto;
  padding: 0.55rem 0.8rem;
  background: #fff;
  border: 1px solid #e3e8ed;
  border-radius: 0.75rem;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
}

.search input:disabled {
  cursor: default;
}

.search-icon {
  opacity: 0.55;
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><circle cx='11' cy='11' r='6.5'/><path d='m16 16 4 4'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><circle cx='11' cy='11' r='6.5'/><path d='m16 16 4 4'/></svg>");
}

kbd {
  padding: 0.12rem 0.35rem;
  border: 1px solid #e3e8ed;
  border-radius: 0.35rem;
  color: #6b7380;
  font-size: 0.72rem;
}

.search-results {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  right: 0;
  z-index: 8;
  margin: 0;
  padding: 0.35rem;
  max-height: min(22rem, 70vh);
  overflow: auto;
  list-style: none;
  background: #fff;
  border: 1px solid #e3e8ed;
  border-radius: 0.75rem;
  box-shadow: 0 10px 28px rgb(26 31 38 / 12%);
}

.search-empty {
  padding: 0.7rem 0.75rem;
  color: #6b7380;
  font-size: 0.88rem;
}

.search-hit {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.55rem;
  border-radius: 0.55rem;
  cursor: pointer;
}

.search-hit.active {
  background: #fff1e6;
}

.search-hit-icon {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.5rem;
  font-size: 0.78rem;
}

.search-hit-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tile-text-color, inherit);
  font-size: 0.9rem;
  font-weight: 600;
}

.search-hit-type {
  color: #6b7380;
  font-size: 0.75rem;
  white-space: nowrap;
}

.mobile-sign-out {
  display: none;
  grid-area: auto;
  justify-self: auto;
  font-size: 0.8rem;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.bell {
  position: relative;
  appearance: none;
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid #e3e8ed;
  border-radius: 999px;
  background: #fff;
  cursor: default;
}

.bell-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  opacity: 0.75;
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M6 16.5h12l-1.2-2.1V11a4.8 4.8 0 1 0-9.6 0v3.4z'/><path d='M10 18.2a2 2 0 0 0 4 0'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M6 16.5h12l-1.2-2.1V11a4.8 4.8 0 1 0-9.6 0v3.4z'/><path d='M10 18.2a2 2 0 0 0 4 0'/></svg>");
}

.badge {
  position: absolute;
  top: -0.2rem;
  right: -0.15rem;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: #e23b3b;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1rem;
}

.content {
  padding: 0.6rem 1.6rem 2.4rem;
}

.greeting h1 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.7rem, 3vw, 2.15rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.greeting p {
  margin: 0 0 1.4rem;
  color: #5c6570;
}

.grid-row {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1.15rem;
  margin-bottom: 1.15rem;
}

.section {
  grid-column: var(--col-start, 1) / span var(--weight, 12);
  min-width: 0;
  scroll-margin-top: 1rem;
  border-radius: 0.95rem;
  padding: 1rem 1.1rem 1.15rem;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.section-head h2 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.3rem;
}

.section-head a {
  color: #6b7380;
  font-size: 0.82rem;
  text-decoration: none;
}

.section-head a:hover {
  color: #1a1f26;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.6rem, 1fr));
  gap: 0.75rem;
}

.tile-grid-detail {
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.85rem;
}

.tile,
.list-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  background: #fff;
  border: 1px solid #e7ecf1;
  border-radius: 0.9rem;
  box-shadow: 0 1px 2px rgb(26 31 38 / 4%);
  color: inherit;
  text-decoration: none;
}

.tile {
  min-height: 7.1rem;
  padding: 1rem 0.55rem 0.85rem;
  text-align: center;
}

.tile strong {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: var(--tile-text-color, inherit);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tile-detail {
  align-items: flex-start;
  min-height: 8.2rem;
  padding: 1rem 1rem 0.9rem;
  text-align: left;
}

.tile-detail strong {
  font-size: 0.92rem;
}

.tile-detail small,
.list-copy small {
  color: #6b7380;
  font-size: 0.78rem;
}

.tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.7rem;
}

.letter-mark {
  background: #eef3f8;
  color: var(--tile-icon-color, #3d5a80);
  font-size: 0.95rem;
  font-weight: 750;
}

.tile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.tile-detail .tile-tags {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
}

.tile-tag {
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #fde4d0;
  color: #c45a16;
  font-size: 0.62rem;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.tile-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.list-item {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  min-height: 0;
  padding: 0.7rem 0.85rem;
  text-align: left;
}

.list-item::after {
  content: '›';
  margin-left: auto;
  color: #9aa3ad;
  font-size: 1.1rem;
}

.list-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.list-copy strong {
  color: var(--tile-text-color, inherit);
  font-size: 0.88rem;
  font-weight: 600;
}

.list-item .tile-icon {
  width: 2rem;
  height: 2rem;
}

.privilege-gate {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgb(26 31 38 / 45%);
}

.privilege-gate-card {
  width: min(22rem, 100%);
  padding: 1.4rem 1.35rem 1.25rem;
  background: #fff;
  border-radius: 0.95rem;
  box-shadow: 0 12px 40px rgb(26 31 38 / 16%);
  text-align: center;
}

.privilege-gate-card p {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 650;
}

.privilege-gate-card button {
  appearance: none;
  border: 0;
  border-radius: 0.6rem;
  padding: 0.55rem 1.1rem;
  background: #f47b20;
  color: #fff;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.privilege-gate-card button:hover {
  background: #e06e14;
}

@media (max-width: 960px) {
  .launchpad {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    display: none;
  }

  .mobile-brand {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.55rem;
    padding: 0;
  }

  .brand-name {
    font-size: 0.95rem;
  }

  .topbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem 0.75rem;
    padding: max(0.9rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.2rem max(1rem, env(safe-area-inset-left));
  }

  .search {
    grid-column: 1 / -1;
    max-width: none;
    margin: 0;
    width: 100%;
  }

  .search kbd {
    display: none;
  }

  .mobile-sign-out {
    display: inline;
  }

  .greeting p {
    display: none;
  }

  .content {
    padding: 0.5rem max(1rem, env(safe-area-inset-right)) max(2rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  }

  .grid-row,
  .section {
    display: block;
  }

  .section + .section,
  .grid-row + .grid-row {
    margin-top: 1.15rem;
  }

  .tile-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .tile {
    min-height: 6.4rem;
    padding: 0.75rem 0.35rem 0.6rem;
  }

  .tile strong {
    font-size: 0.72rem;
  }

  .tile-grid-detail,
  .tile-list {
    grid-template-columns: 1fr;
  }
}
</style>
