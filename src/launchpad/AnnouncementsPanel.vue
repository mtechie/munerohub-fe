<script setup lang="ts">
import type { HubAnnouncement } from '../auth/announcements'
import AnnouncementCard from './AnnouncementCard.vue'

defineProps<{
  items: HubAnnouncement[]
  loading?: boolean
  showViewAll?: boolean
  showBack?: boolean
}>()

const emit = defineEmits<{
  viewAll: []
  back: []
  more: [id: string]
}>()
</script>

<template>
  <section class="announcements" aria-labelledby="announcements-title">
    <header class="announcements-head">
      <h2 id="announcements-title">
        <span class="section-icon announcements-mark hub-icon-megaphone" aria-hidden="true"></span>
        Announcements
      </h2>
      <button
        v-if="showBack"
        type="button"
        class="section-view-all"
        @click="emit('back')"
      >
        ← Back
      </button>
      <button
        v-else-if="showViewAll"
        type="button"
        class="section-view-all"
        @click="emit('viewAll')"
      >
        View all →
      </button>
    </header>

    <div v-if="loading" class="announcement-status" role="status" aria-live="polite" aria-busy="true">
      <span class="announcement-spinner" aria-hidden="true"></span>
      <p>Loading announcements…</p>
    </div>
    <p v-else-if="!items.length" class="announcement-empty">No announcements</p>
    <div v-else class="announcement-list">
      <AnnouncementCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @more="emit('more', item.id)"
      />
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
  min-height: 2.5rem;
  padding: 0.35rem 0.15rem;
  color: #2f6fed;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 650;
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

.announcement-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  padding: 1.1rem 0.5rem;
  color: #6b7380;
  font-size: 0.88rem;
}

.announcement-status p {
  margin: 0;
}

.announcement-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 0.18rem solid #e7ecf1;
  border-top-color: #f47b20;
  border-radius: 999px;
  animation: announcement-spin 0.7s linear infinite;
}

.announcement-empty {
  margin: 0;
  padding: 0.55rem 0 0.2rem;
  color: #6b7380;
  font-size: 0.9rem;
}

@keyframes announcement-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
