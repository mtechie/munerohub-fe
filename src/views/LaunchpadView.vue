<script setup lang="ts">
import { computed } from 'vue'
import { logout, user } from '../auth/authStore'
import { hasPrivilege, privilegeAppUrl, privileges } from '../auth/privileges'
import { collectLaunchpadRows, type LaunchpadSection, type LaunchpadTile } from '../launchpad/sections'
import '../launchpad/icons.css'

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

const rows = computed(() => collectLaunchpadRows(privileges.value))

const navItems: Array<{ id: string; label: string; href: string; icon: string; active?: boolean }> = [
  { id: 'home', label: 'Home', href: '#top', icon: 'home', active: true },
  { id: 'applications', label: 'Applications', href: '#my-applications', icon: 'apps' },
  { id: 'announcements', label: 'Announcements', href: '#announcements', icon: 'megaphone' },
  { id: 'policies', label: 'Policies', href: '#policies', icon: 'document' },
  { id: 'test-environments', label: 'Test Environments', href: '#test-environments', icon: 'beaker' },
]

function tilesOf(section: LaunchpadSection): LaunchpadTile[] {
  return section.tiles.filter((tile) => hasPrivilege(tile.identifier))
}

function tileHref(tile: LaunchpadTile): string | undefined {
  return privilegeAppUrl(tile.identifier) ?? tile.url
}

function letterMark(name: string): string {
  const letter = name.trim().charAt(0)
  return letter ? letter.toUpperCase() : '?'
}

function isStagingTag(tags: string[]): boolean {
  return tags.some((tag) => tag.toUpperCase() === 'STAGING')
}

function stagingCaption(tile: LaunchpadTile): string {
  return tile.description || 'Staging environment'
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
          <span class="nav-icon" :data-icon="item.icon" aria-hidden="true"></span>
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
          <button type="button" class="sign-out" @click="logout">Sign out</button>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="mobile-brand">
          <img class="brand-mark" src="/favicon.svg" alt="" />
          <p class="brand-name">Munero Hub</p>
        </div>
        <label class="search">
          <span class="search-icon" aria-hidden="true"></span>
          <input type="search" placeholder="Search apps, policies and resources" @keydown.enter.prevent />
          <kbd>⌘ K</kbd>
        </label>
        <div class="top-actions">
          <button type="button" class="bell" aria-label="Notifications">
            <span class="bell-icon" aria-hidden="true"></span>
            <span class="badge">3</span>
          </button>
          <span class="avatar header-avatar" aria-hidden="true">{{ avatarLetter }}</span>
        </div>
      </header>

      <div class="content">
        <section class="greeting">
          <h1>{{ greeting }} 👋</h1>
          <p>Here's your personalized hub. Access the tools, updates, and resources you need.</p>
        </section>

        <div v-for="row in rows" :key="row.row" class="grid-row">
          <section
            v-for="section in row.sections"
            :id="section.id !== 'hub-aside' ? section.id : undefined"
            :key="section.id"
            class="section"
            :class="`variant-${section.variant}`"
            :style="{
              '--weight': String(section.weight),
              backgroundColor: section.backgroundColor || undefined,
            }"
          >
            <template v-if="section.variant === 'aside'">
              <article id="announcements" class="side-card">
                <header class="section-head">
                  <h2>Announcements</h2>
                  <a href="#announcements">View all →</a>
                </header>
                <div class="announce-item">
                  <span class="announce-icon" aria-hidden="true"></span>
                  <div>
                    <p>Information Security Policy Updated</p>
                    <time>2 days ago</time>
                  </div>
                  <span class="tag">Important</span>
                </div>
              </article>

              <article id="policies" class="side-card">
                <header class="section-head">
                  <h2>Policies &amp; Resources</h2>
                  <a href="#policies">View all →</a>
                </header>
                <a class="policy-item" href="#policies">Employee Code of Conduct</a>
                <a class="policy-item" href="#policies">Security Practices</a>
              </article>
            </template>

            <template v-else>
              <header class="section-head">
                <h2>{{ section.title }}</h2>
                <a :href="`#${section.id}`">View all →</a>
              </header>

              <div v-if="section.variant === 'staging'" class="staging-grid">
                <component
                  :is="tileHref(tile) ? 'a' : 'div'"
                  v-for="tile in tilesOf(section)"
                  :key="tile.identifier"
                  class="staging-card"
                  v-bind="tileHref(tile) ? { href: tileHref(tile), target: '_blank', rel: 'noreferrer' } : {}"
                >
                  <span v-if="isStagingTag(tile.tags) || section.variant === 'staging'" class="staging-tag">
                    STAGING
                  </span>
                  <span v-if="tile.icon" class="tile-icon" :class="tile.icon" aria-hidden="true"></span>
                  <span v-else class="tile-icon letter-mark" aria-hidden="true">{{ letterMark(tile.name) }}</span>
                  <strong>{{ tile.name }}</strong>
                  <small>{{ stagingCaption(tile) }}</small>
                </component>
                <p v-if="!tilesOf(section).length" class="empty">No test environments assigned.</p>
              </div>

              <div v-else class="apps-grid">
                <component
                  :is="tileHref(tile) ? 'a' : 'div'"
                  v-for="tile in tilesOf(section)"
                  :key="tile.identifier"
                  class="app-tile"
                  v-bind="tileHref(tile) ? { href: tileHref(tile), target: '_blank', rel: 'noreferrer' } : {}"
                >
                  <span v-if="tile.icon" class="tile-icon" :class="tile.icon" aria-hidden="true"></span>
                  <span v-else class="tile-icon letter-mark" aria-hidden="true">{{ letterMark(tile.name) }}</span>
                  <span class="app-name">{{ tile.name }}</span>
                </component>
                <p v-if="!tilesOf(section).length" class="empty">No applications assigned.</p>
              </div>
            </template>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.launchpad {
  min-height: 100vh;
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
.announce-icon,
.m365-mark {
  display: inline-block;
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 1.15rem;
  background: currentColor;
  -webkit-mask: center / contain no-repeat;
  mask: center / contain no-repeat;
}

.nav-icon[data-icon='home'] {
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z'/></svg>");
}

.nav-icon[data-icon='apps'] {
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><rect x='4' y='4' width='6' height='6' rx='1'/><rect x='14' y='4' width='6' height='6' rx='1'/><rect x='4' y='14' width='6' height='6' rx='1'/><rect x='14' y='14' width='6' height='6' rx='1'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><rect x='4' y='4' width='6' height='6' rx='1'/><rect x='14' y='4' width='6' height='6' rx='1'/><rect x='4' y='14' width='6' height='6' rx='1'/><rect x='14' y='14' width='6' height='6' rx='1'/></svg>");
}

.nav-icon[data-icon='megaphone'] {
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M4 10v4h3l7 4V6L7 10H4z'/><path d='M14 9.5c1.4.6 2.4 1.7 2.4 3s-1 2.4-2.4 3'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M4 10v4h3l7 4V6L7 10H4z'/><path d='M14 9.5c1.4.6 2.4 1.7 2.4 3s-1 2.4-2.4 3'/></svg>");
}

.nav-icon[data-icon='document'] {
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M7 3.5h7l4 4V20.5H7z'/><path d='M14 3.5V8h4.5'/><path d='M9.5 12h5M9.5 15.5h5'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M7 3.5h7l4 4V20.5H7z'/><path d='M14 3.5V8h4.5'/><path d='M9.5 12h5M9.5 15.5h5'/></svg>");
}

.nav-icon[data-icon='beaker'] {
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M9 3.5h6M10 3.5v5.2L5.6 19.2A1.6 1.6 0 0 0 7 21.5h10a1.6 1.6 0 0 0 1.4-2.3L14 8.7V3.5'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M9 3.5h6M10 3.5v5.2L5.6 19.2A1.6 1.6 0 0 0 7 21.5h10a1.6 1.6 0 0 0 1.4-2.3L14 8.7V3.5'/></svg>");
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

.user-meta small,
.announce-item time {
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
  grid-column: span var(--weight, 12);
  min-width: 0;
  scroll-margin-top: 1rem;
}

.variant-apps,
.variant-staging {
  background: transparent;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.section-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.section-head a,
.policy-item {
  color: #6b7380;
  font-size: 0.82rem;
  text-decoration: none;
}

.section-head a:hover,
.policy-item:hover {
  color: #1a1f26;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.6rem, 1fr));
  gap: 0.75rem;
}

.app-tile,
.staging-card {
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

.app-tile {
  min-height: 7.1rem;
  padding: 1rem 0.55rem 0.85rem;
  text-align: center;
}

.app-name {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
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
  color: #3d5a80;
  font-size: 0.95rem;
  font-weight: 750;
}

.staging-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.85rem;
}

.staging-card {
  align-items: flex-start;
  min-height: 8.2rem;
  padding: 1rem 1rem 0.9rem;
}

.staging-card strong {
  font-size: 0.92rem;
}

.staging-card small {
  color: #6b7380;
  font-size: 0.78rem;
}

.staging-tag {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #fde4d0;
  color: #c45a16;
  font-size: 0.62rem;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.variant-aside {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.side-card {
  background: #fff;
  border: 1px solid #e7ecf1;
  border-radius: 0.95rem;
  padding: 1rem 1.05rem 0.95rem;
  scroll-margin-top: 1rem;
}

.announce-item,
.policy-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.announce-item p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}

.announce-icon {
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 999px;
  background: #e8f6ee;
  -webkit-mask: none;
  mask: none;
}

.announce-icon::before {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  background: #1b7a3a;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M12 3.5 4.5 7v6.2c0 4.2 3.1 6.8 7.5 8.3 4.4-1.5 7.5-4.1 7.5-8.3V7z'/><path d='m8.8 12.1 2.2 2.2 4.2-4.3'/></svg>") center / 1rem no-repeat;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' stroke-width='1.8' viewBox='0 0 24 24'><path d='M12 3.5 4.5 7v6.2c0 4.2 3.1 6.8 7.5 8.3 4.4-1.5 7.5-4.1 7.5-8.3V7z'/><path d='m8.8 12.1 2.2 2.2 4.2-4.3'/></svg>") center / 1rem no-repeat;
}

.tag {
  margin-left: auto;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #e8f6ee;
  color: #1b7a3a;
  font-size: 0.68rem;
  font-weight: 700;
}

.policy-item {
  padding: 0.55rem 0;
  border-top: 1px solid #eef1f4;
  font-size: 0.88rem;
  font-weight: 550;
}

.policy-item::after {
  content: '›';
  margin-left: auto;
  color: #9aa3ad;
}

.empty {
  grid-column: 1 / -1;
  margin: 0;
  color: #6b7380;
  font-size: 0.9rem;
}

@media (max-width: 960px) {
  .launchpad {
    grid-template-columns: 1fr;
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
    padding: 0.9rem 1rem 0.2rem;
  }

  .search kbd {
    display: none;
  }

  .content {
    padding: 0.5rem 1rem 2rem;
  }

  .grid-row,
  .section {
    display: block;
  }

  .section + .section,
  .grid-row + .grid-row {
    margin-top: 1.15rem;
  }

  .apps-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .staging-grid {
    grid-template-columns: 1fr;
  }
}
</style>
