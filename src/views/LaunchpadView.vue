<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { announcements, announcementsLoaded, fetchAnnouncements, type HubAnnouncement } from '../auth/announcements'
import { authBusy, getAccessToken, isAuthenticated, logout, user } from '../auth/authStore'
import {
  fetchAndStorePrivileges,
  getPrivilege,
  onPrivilegesChanged,
  privileges,
  privilegesLoadFailed,
  privilegesReady,
  sections,
} from '../auth/privileges'
import AnnouncementsPanel from '../launchpad/AnnouncementsPanel.vue'
import LaunchpadRows from '../launchpad/LaunchpadRows.vue'
import { collectLaunchpadRows, type LaunchpadRow, type LaunchpadSection } from '../launchpad/sections'
import '../launchpad/grid.css'
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
const identityFields = computed(() => {
  const profile = user.value
  if (!profile) {
    return []
  }
  return [
    { label: 'Name', value: profile.name },
    { label: 'Given name', value: profile.givenName },
    { label: 'Family name', value: profile.familyName },
    { label: 'Email', value: profile.email },
    { label: 'Username', value: profile.username },
    { label: 'Subject', value: profile.sub },
  ].filter((field): field is { label: string; value: string } => Boolean(field.value))
})

const HOME_NAV = 'home'
const ANNOUNCEMENTS_NAV = 'announcements'
const POLICIES_SECTION = 'policies'

const route = useRoute()
const router = useRouter()

const layoutRows = ref<LaunchpadRow[]>([])
const layoutReady = ref(false)
const privilegesUpdated = ref(false)
const activeNavId = ref(HOME_NAV)

const searchQuery = ref('')
const searchOpen = ref(false)
const highlightedIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)
const searchRoot = ref<HTMLElement | null>(null)
const userMenuOpen = ref(false)
const userMenuRoot = ref<HTMLElement | null>(null)

const showAnnouncements = computed(() => announcements.value.length > 0)
const hasUrgentAnnouncements = computed(() => announcements.value.some((item) => item.priority === 'High'))

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function hubQuery(section: string, announcementId?: string): Record<string, string> {
  const query: Record<string, string> = {}
  if (section !== HOME_NAV) {
    query.section = section
  }
  if (announcementId) {
    query.announcement = announcementId
  }
  return query
}

function routeSection(): string {
  return queryString(route.query.section) ?? HOME_NAV
}

function routeAnnouncementId(): string | undefined {
  return queryString(route.query.announcement)
}

function queriesMatch(section: string, announcementId?: string): boolean {
  return routeSection() === section && (routeAnnouncementId() ?? '') === (announcementId ?? '')
}

function resolvedSection(section: string): string {
  if (section === HOME_NAV) {
    return HOME_NAV
  }
  if (section === ANNOUNCEMENTS_NAV) {
    if (showAnnouncements.value || !announcementsLoaded.value) {
      return ANNOUNCEMENTS_NAV
    }
    return HOME_NAV
  }
  if (!layoutReady.value) {
    return section
  }
  return sectionExists(section) ? section : HOME_NAV
}

function navigateHub(section: string, announcementId?: string, mode: 'push' | 'replace' = 'push'): void {
  const nextSection = resolvedSection(section)
  if (queriesMatch(nextSection, announcementId)) {
    activeNavId.value = nextSection
    return
  }
  const target = { name: 'home' as const, query: hubQuery(nextSection, announcementId) }
  if (mode === 'replace') {
    void router.replace(target)
  } else {
    void router.push(target)
  }
}

function applyLayout(): void {
  layoutRows.value = collectLaunchpadRows(privileges.value, sections.value)
  layoutReady.value = true
  privilegesUpdated.value = false
  const requested = routeSection()
  const next = resolvedSection(requested)
  if (next !== requested) {
    navigateHub(next, routeAnnouncementId(), 'replace')
    return
  }
  activeNavId.value = next
}

function sectionExists(id: string): boolean {
  return layoutRows.value.some((row) => row.sections.some((section) => section.id === id && section.tiles.length > 0))
}

function isBottomRow(row: LaunchpadRow): boolean {
  return row.sections.length > 0 && row.sections.every((section) => section.pin === 'bottom')
}

function stretchLoneUnpinned(row: LaunchpadRow): LaunchpadRow {
  if (row.sections.length === 1 && !row.sections[0].pin) {
    return {
      ...row,
      sections: [{ ...row.sections[0], columnStart: 1, weight: 12 }],
    }
  }
  return row
}

const homePoliciesSection = computed((): LaunchpadSection | undefined => {
  for (const row of layoutRows.value) {
    const section = row.sections.find((item) => item.id === POLICIES_SECTION && item.tiles.length > 0)
    if (section) {
      return { ...section, columnStart: 1, weight: 12 }
    }
  }
  return undefined
})

const homePoliciesRows = computed((): LaunchpadRow[] => {
  const section = homePoliciesSection.value
  if (!section) {
    return []
  }
  return [{ row: 1, sections: [section] }]
})

const showHomeRail = computed(() => showAnnouncements.value || Boolean(homePoliciesSection.value))

const homeFlowRows = computed(() =>
  layoutRows.value
    .filter((row) => !isBottomRow(row))
    .map((row) => ({
      ...row,
      sections: row.sections.filter((section) => section.id !== POLICIES_SECTION),
    }))
    .map(stretchLoneUnpinned)
    .filter((row) => row.sections.length > 0),
)
const homeBottomRows = computed(() => layoutRows.value.filter((row) => isBottomRow(row)))

async function loadAnnouncements(): Promise<void> {
  if (!isAuthenticated.value) {
    return
  }
  const token = await getAccessToken()
  await fetchAnnouncements(token)
}

async function loadPrivilegesUntilReady(): Promise<void> {
  let delayMs = 3000
  while (retryActive && isAuthenticated.value && !privilegesReady.value) {
    const token = await getAccessToken()
    const ok = await fetchAndStorePrivileges(token, { failOpen: false })
    if (ok || privilegesReady.value || !retryActive) {
      return
    }
    await new Promise<void>((resolve) => {
      retryTimer = window.setTimeout(resolve, delayMs)
    })
    delayMs = Math.min(delayMs + 2000, 15000)
  }
}

let retryActive = false
let retryTimer: number | null = null

onMounted(() => {
  retryActive = true
  applyLayout()
  void loadPrivilegesUntilReady()
  if (privilegesReady.value) {
    void loadAnnouncements()
  }
  const stop = onPrivilegesChanged(() => {
    if (authBusy.value || !isAuthenticated.value || !privilegesReady.value) {
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
    if (event.key === 'Escape' && userMenuOpen.value) {
      closeUserMenu()
      return
    }
    if (event.key === 'Escape' && routeAnnouncementId()) {
      event.preventDefault()
      closeAnnouncement()
      return
    }
    if (event.key === 'Escape' && !searchOpen.value && activeNavId.value !== HOME_NAV) {
      event.preventDefault()
      goHome()
    }
  }
  const onDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target
    if (searchOpen.value && !(target instanceof Node && searchRoot.value?.contains(target))) {
      closeSearch()
    }
    if (userMenuOpen.value && !(target instanceof Node && userMenuRoot.value?.contains(target))) {
      closeUserMenu()
    }
  }
  window.addEventListener('keydown', onKey)
  document.addEventListener('pointerdown', onDocumentPointerDown)
  onUnmounted(() => {
    retryActive = false
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
    stop()
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('pointerdown', onDocumentPointerDown)
  })
})

watch(privilegesReady, (ready) => {
  if (!ready) {
    return
  }
  applyLayout()
  void loadAnnouncements()
})

watch(
  () =>
    [
      route.query.section,
      route.query.announcement,
      showAnnouncements.value,
      layoutReady.value,
      announcementsLoaded.value,
    ] as const,
  () => {
    const requested = routeSection()
    const next = resolvedSection(requested)
    if (next !== requested && layoutReady.value && privilegesReady.value) {
      navigateHub(next, routeAnnouncementId(), 'replace')
      return
    }
    activeNavId.value = next
    const announcementId = routeAnnouncementId()
    if (
      announcementId &&
      announcementsLoaded.value &&
      !announcements.value.some((item) => item.id === announcementId)
    ) {
      navigateHub(next, undefined, 'replace')
    }
  },
)

const navItems = computed(() => {
  const fromLayout = layoutRows.value.flatMap((row) =>
    row.sections
      .filter((section) => section.tiles.length > 0)
      .map((section) => ({
        id: section.id,
        label: section.title,
        icon: section.icon,
        announcements: false,
        active: section.id === activeNavId.value,
      })),
  )
  const items = [
    { id: HOME_NAV, label: 'Home', icon: 'hub-icon-home', announcements: false, active: activeNavId.value === HOME_NAV },
  ]
  if (showAnnouncements.value) {
    items.push({
      id: ANNOUNCEMENTS_NAV,
      label: 'Announcements',
      icon: 'hub-icon-megaphone',
      announcements: true,
      active: activeNavId.value === ANNOUNCEMENTS_NAV,
    })
  }
  return [...items, ...fromLayout]
})

const visibleRows = computed((): LaunchpadRow[] => {
  if (activeNavId.value === HOME_NAV || activeNavId.value === ANNOUNCEMENTS_NAV) {
    return layoutRows.value
  }
  for (const row of layoutRows.value) {
    const section = row.sections.find((item) => item.id === activeNavId.value && item.tiles.length > 0)
    if (section) {
      return [{ row: 1, sections: [{ ...section, columnStart: 1, weight: 12 }] }]
    }
  }
  return []
})

function selectNav(id: string): void {
  navigateHub(id)
  document.getElementById('top')?.scrollIntoView()
}

function goHome(): void {
  navigateHub(HOME_NAV)
  document.getElementById('top')?.scrollIntoView()
}

function toggleAnnouncements(): void {
  closeUserMenu()
  if (activeNavId.value === ANNOUNCEMENTS_NAV) {
    goHome()
    return
  }
  selectNav(ANNOUNCEMENTS_NAV)
}

function openAnnouncement(id: string): void {
  navigateHub(activeNavId.value, id)
}

function closeAnnouncement(): void {
  navigateHub(activeNavId.value)
}

const openAnnouncementItem = computed((): HubAnnouncement | undefined => {
  const id = routeAnnouncementId()
  if (!id) {
    return undefined
  }
  return announcements.value.find((item) => item.id === id)
})

function announcementUrgent(item: HubAnnouncement): boolean {
  return item.priority === 'High'
}

function announcementDate(value: string | undefined): string {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

function onSearchBlur(event: FocusEvent): void {
  const next = event.relatedTarget
  if (!(next instanceof Node)) {
    return
  }
  if (!searchRoot.value?.contains(next)) {
    closeSearch()
  }
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
    event.stopPropagation()
    closeSearch()
    searchInput.value?.blur()
  }
}

function activeOptionId(index: number): string {
  return `search-option-${index}`
}

function toggleUserMenu(): void {
  userMenuOpen.value = !userMenuOpen.value
}

function closeUserMenu(): void {
  userMenuOpen.value = false
}

async function signOut(): Promise<void> {
  closeUserMenu()
  await logout()
}
</script>

<template>
  <div id="top" class="launchpad">
    <aside class="sidebar" aria-label="Hub navigation">
      <div class="brand">
        <img class="brand-mark" src="/favicon.png" alt="" />
        <p class="brand-name">Munero Hub</p>
      </div>

      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ active: item.active, 'announcements-nav': item.announcements }"
          :aria-current="item.active ? 'true' : undefined"
          @click="selectNav(item.id)"
        >
          <span class="nav-icon" :class="[item.icon, item.announcements ? 'announcements-mark' : '']" aria-hidden="true"></span>
          {{ item.label }}
        </button>
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
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="mobile-brand">
          <img class="brand-mark" src="/favicon.png" alt="" />
          <p class="brand-name">Munero Hub</p>
        </div>
        <div ref="searchRoot" class="search">
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
            :disabled="!privilegesReady"
            @focus="openSearch"
            @input="openSearch"
            @keydown="onSearchKeydown"
            @blur="onSearchBlur"
          />
          <kbd>⌘ K</kbd>
          <ul
            v-if="searchOpen"
            id="search-listbox"
            class="search-results"
            role="listbox"
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
              @pointerenter="highlightedIndex = index"
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
          <button
            v-if="showAnnouncements"
            type="button"
            class="topbar-announcements announcements-nav"
            :class="{ active: activeNavId === ANNOUNCEMENTS_NAV }"
            :aria-label="hasUrgentAnnouncements ? 'Announcements, urgent items' : 'Announcements'"
            :aria-pressed="activeNavId === ANNOUNCEMENTS_NAV"
            @click="toggleAnnouncements"
          >
            <span class="nav-icon announcements-mark hub-icon-megaphone" aria-hidden="true"></span>
            <span v-if="hasUrgentAnnouncements" class="topbar-announcements-dot" aria-hidden="true"></span>
          </button>
          <div ref="userMenuRoot" class="user-menu">
            <button
              type="button"
              class="user-menu-trigger"
              aria-label="Account menu"
              aria-haspopup="dialog"
              aria-controls="user-menu-panel"
              :aria-expanded="userMenuOpen"
              @click="toggleUserMenu"
            >
              <span class="avatar header-avatar" aria-hidden="true">{{ avatarLetter }}</span>
            </button>
            <div
              v-if="userMenuOpen"
              id="user-menu-panel"
              class="user-menu-panel"
              role="dialog"
              aria-label="Account"
            >
              <dl v-if="identityFields.length" class="user-menu-fields">
                <template v-for="field in identityFields" :key="field.label">
                  <dt>{{ field.label }}</dt>
                  <dd>{{ field.value }}</dd>
                </template>
              </dl>
              <p v-else class="user-menu-empty">No profile details</p>
              <button type="button" class="sign-out" :disabled="authBusy" @click="signOut">Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <div class="content">
        <div v-if="privilegesLoadFailed" class="privileges-load-error" role="status" aria-live="polite">
          <div class="privileges-load-card">
            <p class="privileges-load-title">Something went wrong</p>
            <p>We're working on it.</p>
          </div>
        </div>

        <template v-else-if="privilegesReady">
          <section class="greeting">
            <h1>{{ greeting }} 👋</h1>
            <p>Here's your personalized hub. Access the tools, updates, and resources you need.</p>
          </section>

          <AnnouncementsPanel
            v-if="activeNavId === ANNOUNCEMENTS_NAV && showAnnouncements"
            :items="announcements"
            :show-back="true"
            @back="goHome"
            @more="openAnnouncement"
          />

          <template v-else-if="activeNavId === HOME_NAV">
            <div class="home-cluster" :class="{ 'with-rail': showHomeRail }">
              <div class="home-flow">
                <LaunchpadRows :rows="homeFlowRows" :show-view-all="true" @select-nav="selectNav" />
              </div>
              <div v-if="showHomeRail" class="home-rail">
                <div class="desktop-announcements">
                  <AnnouncementsPanel
                    v-if="showAnnouncements"
                    :items="announcements"
                    :show-view-all="true"
                    @view-all="selectNav(ANNOUNCEMENTS_NAV)"
                    @more="openAnnouncement"
                  />
                </div>
                <div v-if="homePoliciesRows.length" class="home-policies">
                  <LaunchpadRows :rows="homePoliciesRows" :show-view-all="true" @select-nav="selectNav" />
                </div>
              </div>
            </div>
            <LaunchpadRows :rows="homeBottomRows" :show-view-all="true" @select-nav="selectNav" />
          </template>

          <LaunchpadRows
            v-else
            :rows="visibleRows"
            :show-view-all="false"
            :show-back="true"
            @select-nav="selectNav"
            @back="goHome"
          />
        </template>
      </div>
    </div>

    <div
      v-if="openAnnouncementItem"
      class="announcement-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-modal-title"
      @click.self="closeAnnouncement"
    >
      <div class="announcement-modal-card" :class="announcementUrgent(openAnnouncementItem) ? 'priority-high' : 'priority-normal'">
        <div class="announcement-modal-head">
          <span class="announcement-modal-badge">{{ announcementUrgent(openAnnouncementItem) ? 'Urgent' : 'Important' }}</span>
          <button type="button" class="announcement-modal-close" @click="closeAnnouncement">Close</button>
        </div>
        <h2 id="announcement-modal-title">{{ openAnnouncementItem.title }}</h2>
        <time v-if="announcementDate(openAnnouncementItem.publishFrom)" class="announcement-modal-date">
          {{ announcementDate(openAnnouncementItem.publishFrom) }}
        </time>
        <p class="announcement-modal-body">{{ openAnnouncementItem.message }}</p>
        <a
          v-if="openAnnouncementItem.link"
          class="announcement-modal-link"
          :href="openAnnouncementItem.link"
          target="_blank"
          rel="noreferrer"
        >
          Open link →
        </a>
      </div>
    </div>

    <div v-if="privilegesUpdated && privilegesReady && !authBusy && isAuthenticated" class="privilege-gate" role="dialog" aria-modal="true" aria-labelledby="privilege-gate-title">
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
  height: 2.35rem;
  object-fit: contain;
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
  width: 100%;
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0.62rem 0.8rem;
  border-radius: 0.65rem;
  color: inherit;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
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
.m365-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 1.15rem;
}

.search-icon,
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
  grid-template-areas: 'avatar meta';
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
  appearance: none;
  border: 0;
  background: #fff1e6;
  width: 100%;
  min-height: 2.75rem;
  margin-top: 0.35rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.55rem;
  color: #8a4b16;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
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
  touch-action: pan-y;
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
  min-height: 2.75rem;
  padding: 0.55rem 0.6rem;
  border-radius: 0.55rem;
  cursor: pointer;
  touch-action: manipulation;
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

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  margin-left: auto;
}

.topbar-announcements {
  display: none;
  position: relative;
  appearance: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #1a1f26;
  cursor: pointer;
  touch-action: manipulation;
}

.topbar-announcements:hover,
.topbar-announcements.active {
  background: #fff1e6;
  color: #c45a16;
}

.topbar-announcements:focus-visible,
.user-menu-trigger:focus-visible {
  outline: 2px solid #f47b20;
  outline-offset: 2px;
}

.topbar-announcements .nav-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-basis: 1.25rem;
}

.topbar-announcements .nav-icon::before {
  width: 1.25rem;
  height: 1.25rem;
}

.topbar-announcements-dot {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: #d64545;
  box-shadow: 0 0 0 2px #fff;
}

.user-menu {
  position: relative;
}

.user-menu-trigger {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: 999px;
  background: none;
  padding: 0;
  cursor: pointer;
  touch-action: manipulation;
}

.user-menu-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 9;
  width: min(20rem, calc(100vw - 2rem));
  padding: 0.9rem 1rem 0.85rem;
  background: #fff;
  border: 1px solid #e3e8ed;
  border-radius: 0.85rem;
  box-shadow: 0 10px 28px rgb(26 31 38 / 12%);
}

.user-menu-fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 0.85rem;
  margin: 0 0 0.35rem;
}

.user-menu-fields dt {
  color: #6b7380;
  font-size: 0.75rem;
}

.user-menu-fields dd {
  margin: 0;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}

.user-menu-empty {
  margin: 0 0 0.35rem;
  color: #6b7380;
  font-size: 0.88rem;
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

.home-cluster {
  display: grid;
  gap: 1.15rem;
  margin-bottom: 1.15rem;
  align-items: start;
}

.home-cluster.with-rail {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
}

.home-flow {
  min-width: 0;
}

.home-flow :deep(.grid-row:last-child) {
  margin-bottom: 0;
}

.home-rail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.home-policies :deep(.grid-row) {
  margin-bottom: 0;
}

.home-policies :deep(.section) {
  background: #fff;
  border: 1px solid #e7ecf1;
  box-shadow: 0 1px 2px rgb(26 31 38 / 4%);
}

.privileges-load-error {
  display: flex;
  justify-content: center;
  padding: 2.5rem 0 1rem;
}

.privileges-load-card {
  width: min(24rem, 100%);
  padding: 1.4rem 1.35rem 1.25rem;
  background: #fff;
  border-radius: 0.95rem;
  box-shadow: 0 12px 40px rgb(26 31 38 / 16%);
  text-align: center;
}

.privileges-load-title {
  margin: 0 0 0.45rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.privileges-load-card p {
  margin: 0;
  color: #5c6570;
  font-size: 0.95rem;
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
  min-height: 2.75rem;
  padding: 0.55rem 1.1rem;
  background: #f47b20;
  color: #fff;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
  touch-action: manipulation;
}

.privilege-gate-card button:hover {
  background: #e06e14;
}

.announcement-modal {
  position: fixed;
  inset: 0;
  z-index: 24;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgb(26 31 38 / 45%);
}

.announcement-modal-card {
  width: min(32rem, 100%);
  max-height: min(36rem, calc(100vh - 3rem));
  overflow: auto;
  padding: 1.25rem 1.3rem 1.2rem;
  background: #fff;
  border-radius: 0.95rem;
  border-left: 0.35rem solid #2f9e60;
  box-shadow: 0 12px 40px rgb(26 31 38 / 16%);
}

.announcement-modal-card.priority-high {
  border-left-color: #d64545;
}

.announcement-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}

.announcement-modal-badge {
  font-size: 0.82rem;
  font-weight: 750;
  color: #1b7a3a;
}

.announcement-modal-card.priority-high .announcement-modal-badge {
  color: #c0392b;
}

.announcement-modal-close {
  appearance: none;
  border: 0;
  background: none;
  min-height: 2.5rem;
  padding: 0.3rem 0.2rem;
  color: #2f6fed;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 650;
  cursor: pointer;
  touch-action: manipulation;
}

.announcement-modal-card h2 {
  margin: 0 0 0.35rem;
  font-size: 1.2rem;
  font-weight: 750;
}

.announcement-modal-date {
  display: block;
  margin-bottom: 0.75rem;
  color: #6b7380;
  font-size: 0.82rem;
}

.announcement-modal-body {
  margin: 0;
  color: #3d4650;
  font-size: 0.95rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.announcement-modal-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  margin-top: 1rem;
  color: #2f6fed;
  font-weight: 700;
  text-decoration: none;
  touch-action: manipulation;
}

.announcement-modal-link:hover {
  color: #1a1f26;
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
    grid-column: 1;
    grid-row: 1;
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

  .top-actions {
    grid-column: 2;
    grid-row: 1;
  }

  .topbar-announcements {
    display: inline-flex;
  }

  .search {
    grid-column: 1 / -1;
    grid-row: 2;
    max-width: none;
    margin: 0;
    width: 100%;
  }

  .search kbd {
    display: none;
  }

  .greeting p {
    display: none;
  }

  .content {
    padding: 0.5rem max(1rem, env(safe-area-inset-right)) max(2rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  }

  .home-cluster.with-rail {
    grid-template-columns: minmax(0, 1fr);
  }

  .desktop-announcements {
    display: none;
  }
}
</style>
