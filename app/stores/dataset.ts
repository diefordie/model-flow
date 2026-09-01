/**
 * Dataset store.
 *
 * Holds the current project's datasets, the active dataset (the one being
 * inspected), and its profile. Preview/pagination lives in the page
 * component itself — this store only owns the profile + metadata, so
 * switching datasets doesn't refetch the paginated preview.
 */

import { defineStore } from 'pinia'
import type { Dataset, ColumnMeta } from '~/types/api'

export const useDatasetStore = defineStore('dataset', () => {
  const api = useApi()

  const datasets = ref<Dataset[]>([])
  const activeDataset = ref<Dataset | null>(null)
  const profile = ref<ColumnMeta[] | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(projectId: string) {
    isLoading.value = true
    error.value = null
    try {
      datasets.value = await api.listDatasets(projectId)
      // auto-select first dataset if none active
      if (!activeDataset.value && datasets.value.length > 0) {
        await selectDataset(datasets.value[0])
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load datasets'
      datasets.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function selectDataset(dataset: Dataset) {
    activeDataset.value = dataset
    profile.value = null
    try {
      const res = await api.getDatasetProfile(dataset.id)
      profile.value = res.columns
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load profile'
      profile.value = []
    }
  }

  function reset() {
    datasets.value = []
    activeDataset.value = null
    profile.value = null
    error.value = null
  }

  // local helper — current project ID of the loaded datasets
  const currentProjectId = computed(() => datasets.value[0]?.projectId ?? null)

  return {
    datasets, activeDataset, profile,
    isLoading, error,
    fetchAll, selectDataset, reset,
    currentProjectId
  }
})