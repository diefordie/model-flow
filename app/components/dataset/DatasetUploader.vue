<script setup lang="ts">
/**
 * DatasetUploader — drag-and-drop CSV/XLSX.
 *
 * PRD §6.1 `/projects/:id/dataset`: "drag-and-drop CSV/XLSX, calls
 * POST /projects/:projectId/datasets".
 *
 * MVP UI: drop zone + browse button + file type/size validation client-side.
 * The actual upload flow is mocked — clicking "Upload" simulates the
 * server-side parse/profile and emits an `uploaded` event so the parent
 * can refetch the dataset list. Real multipart upload wiring happens
 * when backend is live (see `composables/useApi.ts` §USE_MOCK).
 */
import { formatBytes } from '~/utils/format'

const props = defineProps<{
  projectId: string
  isUploading?: boolean
}>()
const emit = defineEmits<{
  (e: 'uploaded', dataset: { id: string; filename: string }): void
}>()

const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selected = ref<File | null>(null)
const error = ref<string | null>(null)

const ACCEPT = ['.csv', '.xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB per PRD §8.2

function validate(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
  const okExt = ACCEPT.includes(ext) || ACCEPT.includes(file.type)
  if (!okExt) return 'Only CSV or XLSX files are supported.'
  if (file.size > MAX_SIZE) return `File is too large (${formatBytes(file.size)} > 10 MB limit).`
  return null
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) select(file)
}

function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) select(file)
}

function select(file: File) {
  error.value = null
  const msg = validate(file)
  if (msg) { error.value = msg; selected.value = null; return }
  selected.value = file
}

function clear() {
  selected.value = null
  error.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function upload() {
  if (!selected.value) return
  // simulate upload — real impl will POST /projects/:projectId/datasets with multipart
  await new Promise(r => setTimeout(r, 900))
  emit('uploaded', { id: 'ds_new', filename: selected.value.name })
  clear()
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}
function onDragLeave() { dragOver.value = false }
</script>

<template>
  <div
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    :class="[
      'rounded-xl border-2 border-dashed transition-colors p-8 text-center',
      dragOver ? 'border-accent bg-accent-50/50' : 'border-ink-200 bg-white hover:border-ink-300'
    ]"
    role="button"
    :aria-label="selected ? `Selected: ${selected.name}` : 'Drop a CSV or XLSX file here, or click to browse'"
    @click="!selected && fileInput?.click()"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="ACCEPT.join(',')"
      class="sr-only"
      @change="onPick"
    />

    <!-- Empty state -->
    <template v-if="!selected">
      <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-ink-100 grid place-items-center">
        <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-ink-500">
          <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="text-sm font-medium mb-1">Drop your dataset here</p>
      <p class="text-xs text-ink-500 mb-3">CSV or XLSX · up to 10 MB · 100,000 rows</p>
      <button type="button" class="btn-ghost border border-ink-200" @click.stop="fileInput?.click()">
        Browse files
      </button>
    </template>

    <!-- Selected file -->
    <template v-else>
      <div class="flex items-center justify-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-md bg-accent-50 grid place-items-center text-accent">
          <svg viewBox="0 0 20 20" fill="none" class="w-5 h-5"><path d="M10 2v10m0 0l-3-3m3 3l3-3M3 16h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div class="text-left min-w-0">
          <div class="text-sm font-medium truncate max-w-xs">{{ selected.name }}</div>
          <div class="text-xs text-ink-500">{{ formatBytes(selected.size) }} · ready to upload</div>
        </div>
      </div>
      <div class="flex items-center justify-center gap-2">
        <button @click.stop="upload" class="btn-primary" :disabled="isUploading">
          {{ isUploading ? 'Uploading…' : 'Upload' }}
        </button>
        <button @click.stop="clear" class="btn-ghost">Cancel</button>
      </div>
    </template>

    <div v-if="error" class="mt-3 text-xs text-danger bg-red-50 border border-red-200 rounded-md px-3 py-1.5 inline-block">
      {{ error }}
    </div>
  </div>
</template>