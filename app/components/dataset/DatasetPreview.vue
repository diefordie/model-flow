<script setup lang="ts">
/**
 * DatasetPreview — paginated table.
 *
 * PRD §6.1: "paginated table using GET /datasets/:datasetId/preview?page=&limit="
 * — backend paginates, frontend renders whatever page it's given.
 */
import type { ColumnMeta, DatasetPreviewResponse } from '~/types/api'

const props = defineProps<{ datasetId: string }>()

const page = ref(1)
const limit = ref(20)
const data = ref<DatasetPreviewResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

async function fetchPage() {
  isLoading.value = true
  error.value = null
  try {
    data.value = await useApi().previewDataset(props.datasetId, page.value, limit.value)
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load preview'
    data.value = null
  } finally {
    isLoading.value = false
  }
}

watch(() => [props.datasetId, page.value, limit.value], fetchPage, { immediate: true })

const totalPages = computed(() => {
  if (!data.value) return 1
  return Math.max(1, Math.ceil(data.value.totalRows / limit.value))
})

function goToPage(n: number) {
  if (n < 1 || n > totalPages.value) return
  page.value = n
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2)
  return String(v)
}

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
    <header class="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold">Data preview</h3>
        <p class="text-xs text-ink-500 mt-0.5">
          <span v-if="data">
            Showing {{ ((page - 1) * limit) + 1 }}–{{ Math.min(page * limit, data.totalRows) }}
            of {{ data.totalRows.toLocaleString() }} rows
          </span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-ink-500">Rows per page</label>
        <select v-model.number="limit" class="input h-8 w-16 py-0 text-xs">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="p-5 space-y-2">
      <div v-for="i in 5" :key="i" class="h-9 bg-ink-50 rounded animate-pulse-soft" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-5 text-sm text-danger bg-red-50/40 border-t border-red-200">
      {{ error }}
    </div>

    <!-- Table — horizontal scroll for wide column sets; sticky header for vertical scroll. -->
    <div v-else-if="data" class="overflow-x-auto max-h-[640px] overflow-y-auto">
      <table class="w-full text-sm" :style="{ minWidth: `${48 + data.columns.length * 110}px` }">
        <thead class="bg-ink-50/50 border-b border-ink-200 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left text-[11px] font-mono uppercase tracking-wider text-ink-500 w-12 sticky left-0 bg-ink-50/80 backdrop-blur-sm">#</th>
            <th
              v-for="col in data.columns"
              :key="col.name"
              class="px-3 py-2 text-left text-[11px] font-medium text-ink-700 whitespace-nowrap"
            >
              <div class="flex items-center gap-1.5">
                <span class="truncate max-w-28" :title="col.name">{{ col.name }}</span>
                <span :class="typeClass(col.dataType)" class="font-mono normal-case shrink-0">{{ col.dataType }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink-100">
          <tr v-for="(row, i) in data.rows" :key="i" class="hover:bg-ink-50/60">
            <td class="px-3 py-2 text-xs text-ink-400 tabular-nums sticky left-0 bg-white group-hover:bg-ink-50">{{ (page - 1) * limit + i + 1 }}</td>
            <td
              v-for="col in data.columns"
              :key="col.name"
              class="px-3 py-2 tabular-nums whitespace-nowrap"
              :class="row[col.name] === null || row[col.name] === undefined || row[col.name] === '' ? 'text-ink-300 italic' : ''"
            >
              {{ formatCell(row[col.name]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <footer v-if="data && !isLoading" class="px-5 py-3 border-t border-ink-200 flex items-center justify-between text-xs">
      <button class="btn-ghost h-8 px-3 text-xs" :disabled="page === 1" @click="goToPage(page - 1)">
        ← Previous
      </button>
      <span class="text-ink-500">Page {{ page }} of {{ totalPages }}</span>
      <button class="btn-ghost h-8 px-3 text-xs" :disabled="page === totalPages" @click="goToPage(page + 1)">
        Next →
      </button>
    </footer>
  </section>
</template>