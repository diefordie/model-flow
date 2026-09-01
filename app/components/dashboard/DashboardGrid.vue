<script setup lang="ts">
/**
 * DashboardGrid — 12-column CSS grid laid out by widget positions.
 *
 * Per PRD §07 §4: widgets carry their own { x, y, width, height };
 * MVP is predefined layout only — no drag/resize (Phase 2).
 */
import DashboardWidget from './DashboardWidget.vue'
import type { DashboardWidget as Widget } from '~/types/api'

const props = defineProps<{
  widgets: Widget[]
  editable?: boolean
}>()
const emit = defineEmits<{ (e: 'remove', id: string): void }>()
</script>

<template>
  <div class="grid grid-cols-12 auto-rows-[180px] gap-3">
    <div
      v-for="w in widgets"
      :key="w.id"
      :style="{
        gridColumn: `span ${w.position.width} / span ${w.position.width}`,
        gridRow: `span ${w.position.height} / span ${w.position.height}`,
        // optional: use x/y if the user wants explicit placement. For now rely on document order.
        order: w.position.y * 12 + w.position.x
      }"
    >
      <DashboardWidget :widget="w" :editable="editable" @remove="(id) => emit('remove', id)" />
    </div>
  </div>
</template>