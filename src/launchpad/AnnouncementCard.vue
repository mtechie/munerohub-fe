<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { HubAnnouncement } from '../auth/announcements'

const props = defineProps<{
  item: HubAnnouncement
}>()

const emit = defineEmits<{
  more: []
}>()

const body = ref<HTMLElement | null>(null)
const overflow = ref(false)
let observer: ResizeObserver | null = null

function isUrgent(): boolean {
  return props.item.priority === 'High'
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

function itemHref(): string | undefined {
  const link = props.item.link
  return link && link.length > 0 ? link : undefined
}

function measure(): void {
  const el = body.value
  if (!el) {
    overflow.value = false
    return
  }
  overflow.value = el.scrollHeight > el.clientHeight + 1
}

onMounted(async () => {
  await nextTick()
  measure()
  observer = new ResizeObserver(() => measure())
  if (body.value) {
    observer.observe(body.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

watch(
  () => props.item.message,
  async () => {
    await nextTick()
    measure()
  },
)
</script>

<template>
  <article class="announcement-card" :class="isUrgent() ? 'priority-high' : 'priority-normal'">
    <div class="announcement-meta">
      <span class="announcement-badge">{{ isUrgent() ? 'Urgent' : 'Important' }}</span>
      <time v-if="formatDate(item.publishFrom)" class="announcement-date">{{ formatDate(item.publishFrom) }}</time>
    </div>
    <strong>{{ item.title }}</strong>
    <p ref="body">{{ item.message }}</p>
    <button v-if="overflow" type="button" class="announcement-more" @click="emit('more')">
      More
    </button>
    <a
      v-if="itemHref()"
      class="announcement-arrow"
      :href="itemHref()"
      target="_blank"
      rel="noreferrer"
      :aria-label="`Open ${item.title}`"
    >
      <span aria-hidden="true">→</span>
    </a>
  </article>
</template>

<style scoped>
.announcement-card {
  position: relative;
  display: block;
  padding: 0.85rem 3.4rem 0.85rem 0.95rem;
  border-radius: 0.75rem;
  border-left: 0.28rem solid transparent;
  color: inherit;
  overflow: hidden;
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

.announcement-more {
  appearance: none;
  display: inline-flex;
  margin-top: 0.45rem;
  padding: 0.2rem 0;
  border: 0;
  background: none;
  color: #2f6fed;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.announcement-more:hover {
  color: #1a1f26;
}

.announcement-arrow {
  position: absolute;
  top: 50%;
  right: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 999px;
  background: #f47b20;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  box-shadow: 0 2px 8px rgb(244 123 32 / 35%);
  transform: translateY(-50%);
  touch-action: manipulation;
}

.announcement-arrow:hover,
.announcement-arrow:focus-visible {
  background: #e06e14;
}
</style>
