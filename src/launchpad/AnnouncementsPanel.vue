<script setup lang="ts">
import type { HubAnnouncement } from '../auth/announcements'

defineProps<{
  items: HubAnnouncement[]
  showViewAll?: boolean
}>()

const emit = defineEmits<{
  viewAll: []
}>()

function isUrgent(item: HubAnnouncement): boolean {
  return item.priority === 'High'
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function itemHref(item: HubAnnouncement): string | undefined {
  return item.link || undefined
}
</script>

<template>
  <section class="announcements" aria-labelledby="announcements-title">
    <header class="announcements-head">
      <h2 id="announcements-title">
        <span class="section-icon announcements-mark hub-icon-megaphone" aria-hidden="true"></span>
        Announcements
      </h2>
      <button
        v-if="showViewAll"
        type="button"
        class="section-view-all"
        @click="emit('viewAll')"
      >
        View all →
      </button>
    </header>

    <div class="announcement-list">
      <component
        :is="itemHref(item) ? 'a' : 'article'"
        v-for="item in items"
        :key="item.id"
        class="announcement-card"
        :class="isUrgent(item) ? 'priority-high' : 'priority-normal'"
        v-bind="itemHref(item) ? { href: itemHref(item), target: '_blank', rel: 'noreferrer' } : {}"
      >
        <div class="announcement-meta">
          <span class="announcement-badge">{{ isUrgent(item) ? 'Urgent' : 'Important' }}</span>
          <time v-if="formatDate(item.publishFrom)" class="announcement-date">{{ formatDate(item.publishFrom) }}</time>
        </div>
        <strong>{{ item.title }}</strong>
        <p>{{ item.message }}</p>
        <span v-if="itemHref(item)" class="announcement-arrow" aria-hidden="true">→</span>
      </component>
    </div>
  </section>
</template>

<style scoped>
.announcements {
  min-width: 0;
  padding: 1rem 1.1rem 1.15rem;
  background: #fff;
  border: 1px solid #e7ecf1;
  border-radius: 0.95rem;
  box-shadow: 0 1px 2px rgb(26 31 38 / 4%);
}

.announcements-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.announcements-head h2 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.section-view-all {
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  color: #2f6fed;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  touch-action: manipulation;
}

.section-view-all:hover {
  color: #1a1f26;
}

.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.announcement-card {
  position: relative;
  display: block;
  padding: 0.85rem 2.1rem 0.85rem 0.95rem;
  border-radius: 0.75rem;
  border-left: 0.28rem solid transparent;
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  touch-action: manipulation;
}

.announcement-card.priority-high {
  background: #fdecee;
  border-left-color: #d64545;
}

.announcement-card.priority-normal {
  background: #eef8f1;
  border-left-color: #2f9e60;
}

.announcement-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.announcement-badge {
  font-size: 0.78rem;
  font-weight: 700;
}

.priority-high .announcement-badge {
  color: #c0392b;
}

.priority-normal .announcement-badge {
  color: #1b7a3a;
}

.announcement-date {
  color: #6b7380;
  font-size: 0.78rem;
  white-space: nowrap;
}

.announcement-card strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.announcement-card p {
  display: -webkit-box;
  margin: 0;
  color: #5c6570;
  font-size: 0.82rem;
  line-height: 1.4;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.announcement-arrow {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  color: #9aa3ad;
  transform: translateY(-50%);
}

a.announcement-card:hover .announcement-arrow,
a.announcement-card:focus-visible .announcement-arrow {
  color: #1a1f26;
}
</style>
