<script setup lang="ts">
/**
 * `/projects/:id/dataset` — Dataset management.
 *
 * PRD §6.1:
 *   - DatasetUploader (drag-and-drop CSV/XLSX)
 *   - DatasetPreview (paginated table)
 *   - DatasetStats / ColumnTable / MissingValueChart
 *
 * UX states: loading, empty (no datasets yet), error, success. All four
 * surface per PRD §3.1 / §8.3.
 */
import MissingValueChart from '~/components/dataset/MissingValueChart.vue'
import ColumnTable from '~/components/dataset/ColumnTable.vue'
import { formatDistanceToNow, formatBytes } from '~/utils/format'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const projectStore = useProjectStore()
const datasetStore = useDatasetStore()

await useAsyncData(`dataset-${projectId.value}`, async () => {
  await projectStore.fetchOne(projectId.value)
  if (projectStore.activeProject) await datasetStore.fetchAll(projectId.value)
  return true
})

const isUploading = ref(false)

async function onUploaded(meta: { id: string; filename: string }) {
  isUploading.value = true
  // simulate server-side parse + profile; refetch datasets when ready
  await new Promise(r => setTimeout(r, 600))
  await datasetStore.fetchAll(projectId.value)
  isUploading.value = false
}

function selectDataset(id: string) {
  const ds = datasetStore.datasets.find(d => d.id === id)
  if (ds) datasetStore.selectDataset(ds)
}

// Sync active dataset to first when project loads
watch(() => datasetStore.datasets.length, (n) => {
  if (n > 0 && !datasetStore.activeDataset) {
    datasetStore.selectDataset(datasetStore.datasets[0])
  }
})

const numericCount = computed(() =>
  datasetStore.profile?.filter(c => c.dataType === 'numeric' || c.dataType === 'binary').length ?? 0
)
const categoricalCount = computed(() =>
  datasetStore.profile?.filter(c => c.dataType === 'categorical' || c.dataType === 'text').length ?? 0
)
const missingTotal = computed(() =>
  datasetStore.profile?.reduce((s, c) => s + c.missing, 0) ?? 0
)
</script>

<template>
  <div v-if="projectStore.isLoading" class="p-8">
    <div class="h-8 w-48 bg-ink-200 rounded animate-pulse-soft mb-6" />
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div v-for="i in 3" :key="i" class="surface p-5 h-24 animate-pulse-soft" />
    </div>
  </div>

  <div v-else-if="!projectStore.activeProject" class="p-8">
    <div class="surface p-6 border-danger/30 bg-red-50/40">
      <div class="text-sm font-medium text-red-700 mb-1">Project not found</div>
      <NuxtLink to="/projects" class="btn-ghost mt-2">← Back to projects</NuxtLink>
    </div>
  </div>

  <div v-else>
    <!-- Top action: uploader -->
    <div class="px-8 pt-6 pb-3 border-b border-ink-200 bg-white">
      <header class="flex items-end justify-between gap-4 mb-4">
        <div>
          <NuxtLink :to="`/projects/${projectId}`" class="text-xs text-ink-500 hover:text-ink-900">← {{ projectStore.activeProject.name }}</NuxtLink>
          <h1 class="text-xl font-semibold tracking-tight mt-1">Dataset</h1>
        </div>
        <div v-if="datasetStore.datasets.length > 1" class="text-xs text-ink-500">
          {{ datasetStore.datasets.length }} datasets in this project
        </div>
      </header>

      <DatasetUploader :project-id="projectId" :is-uploading="isUploading" @uploaded="onUploaded" />
    </div>

    <div class="p-8">
      <!-- No dataset yet -->
      <div v-if="datasetStore.datasets.length === 0 && !datasetStore.isLoading" class="surface p-10 text-center">
        <h3 class="text-base font-semibold mb-1">No dataset yet</h3>
        <p class="text-sm text-ink-500 max-w-md mx-auto">Drop a CSV or XLSX file above to get started. After upload, we'll show a preview and column profile here.</p>
      </div>

      <!-- Active dataset -->
      <template v-else-if="datasetStore.activeDataset">
        <!-- Dataset selector (if multiple) -->
        <div v-if="datasetStore.datasets.length > 1" class="flex items-center gap-2 mb-4 flex-wrap">
          <button
            v-for="ds in datasetStore.datasets"
            :key="ds.id"
            @click="selectDataset(ds.id)"
            :class="[
              'btn-ghost border text-xs h-8 px-3',
              ds.id === datasetStore.activeDataset.id
                ? 'border-accent text-accent bg-accent-50/40'
                : 'border-ink-200'
            ]"
          >
            {{ ds.filename }}
          </button>
        </div>

        <!-- Dataset metadata header -->
        <div class="flex items-center gap-4 mb-6 text-sm">
          <div>
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Filename</div>
            <div class="font-medium mt-0.5">{{ datasetStore.activeDataset.filename }}</div>
          </div>
          <div class="w-px h-8 bg-ink-200" />
          <div>
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Size</div>
            <div class="font-medium mt-0.5 tabular-nums">{{ formatBytes(datasetStore.activeDataset.sizeBytes) }}</div>
          </div>
          <div class="w-px h-8 bg-ink-200" />
          <div>
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Rows × cols</div>
            <div class="font-medium mt-0.5 tabular-nums">{{ datasetStore.activeDataset.rows.toLocaleString() }} × {{ datasetStore.activeDataset.columns }}</div>
          </div>
          <div class="w-px h-8 bg-ink-200" />
          <div>
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Uploaded</div>
            <div class="font-medium mt-0.5">{{ formatDistanceToNow(datasetStore.activeDataset.uploadedAt) }}</div>
          </div>
        </div>

        <!-- Stats summary row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div class="surface p-4">
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Rows</div>
            <div class="text-xl font-semibold mt-1 tabular-nums">{{ datasetStore.activeDataset.rows.toLocaleString() }}</div>
          </div>
          <div class="surface p-4">
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Columns</div>
            <div class="text-xl font-semibold mt-1 tabular-nums">{{ datasetStore.activeDataset.columns }}</div>
          </div>
          <div class="surface p-4">
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Numeric</div>
            <div class="text-xl font-semibold mt-1 tabular-nums">{{ numericCount }}</div>
          </div>
          <div class="surface p-4">
            <div class="text-xs text-ink-500 font-mono uppercase tracking-wider">Missing</div>
            <div class="text-xl font-semibold mt-1 tabular-nums" :class="missingTotal > 0 ? 'text-amber-700' : ''">
              {{ missingTotal.toLocaleString() }}
            </div>
          </div>
        </div>

        <!-- Profiling: Missing values + Column table -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <MissingValueChart
            v-if="datasetStore.profile"
            :columns="datasetStore.profile"
            :total-rows="datasetStore.activeDataset.rows"
          />
          <ColumnTable v-if="datasetStore.profile" :columns="datasetStore.profile" />
        </div>

        <!-- Preview table -->
        <DatasetPreview :dataset-id="datasetStore.activeDataset.id" />
      </template>
    </div>
  </div>
</template>