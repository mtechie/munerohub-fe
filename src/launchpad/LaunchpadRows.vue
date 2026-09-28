<script setup lang="ts">
import type { LaunchpadRow, LaunchpadSection, LaunchpadTile } from './sections'
import './grid.css'

defineProps<{
  rows: LaunchpadRow[]
  showViewAll: boolean
  showBack?: boolean
}>()

const emit = defineEmits<{
  selectNav: [id: string]
  back: []
}>()

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
</script>

<template>
  <div v-for="row in rows" :key="row.row" class="grid-row">
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
            @click="emit('selectNav', section.id)"
          >
            View all →
          </button>
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
</template>
