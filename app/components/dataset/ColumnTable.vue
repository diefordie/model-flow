<script setup lang="ts">
/**
 * ColumnTable — per-column metadata, missing values, type.
 *
 * PRD §6.1: "ColumnTable: rendered from GET /datasets/:datasetId/profile".
 */
import type { ColumnMeta } from '~/types/api'

defineProps<{ columns: ColumnMeta[] }>()

function typeClass(type: ColumnMeta['dataType']): string {
  return {
    numeric:     'badge-neutral',
    binary:      'badge-success',
    categorical: 'badge-warning',
    datetime:    'badge-running',
    text:        'badge-neutral',
    boolean:     'badge-success'
  }[type] ?? 'badge-neutral'
}
</script>

<template>
  <section class="surface overflow-hidden">
    <header class="px-5 py-3 border-b border-ink-200">
      <h3 class="text-sm font-semibold">Columns</h3>
      <p class="text-xs text-ink-500 mt-0.5">{{ columns.length }} columns detected</p>
    </header>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-ink-50/50 border-b border-ink-200">
          <tr>
            <th class="px-3 py-2 text-left text-[11px] font-medium text-ink-700">Name</th>
            <th class="px-3 py-2 text-left text-[11px] font-medium text-ink-700">Type</th>
            <th class="px-3 py-2 text-right text-[11px] font-medium text-ink-700">Unique</th>
            <th class="px-3 py-2 text-right text-[11px] font-medium text-ink-700">Missing</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink-100">
          <tr v-for="col in columns" :key="col.name" class="hover:bg-ink-50/60">
            <td class="px-3 py-2 font-mono text-xs">{{ col.name }}</td>
            <td class="px-3 py-2"><span :class="typeClass(col.dataType)">{{ col.dataType }}</span></td>
            <td class="px-3 py-2 text-right tabular-nums text-ink-600">{{ col.unique ?? '—' }}</td>
            <td class="px-3 py-2 text-right tabular-nums" :class="col.missing > 0 ? 'text-amber-700 font-medium' : 'text-ink-600'">
              {{ col.missing }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>