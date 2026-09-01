/**
 * Experiment store.
 *
 * Holds experiment summaries for the current project + the active
 * experiment (the one being viewed in detail). Status is polled every
 * 2s when the active experiment is running; results are fetched once
 * on demand.
 *
 * `useExperimentStatusPoll` composable owns the polling lifecycle.
 */

import { defineStore } from 'pinia'
import type { ExperimentSummary, ExperimentResults, ExperimentStatusResponse } from '~/types/api'

export const useExperimentStore = defineStore('experiment', () => {
  const api = useApi()

  const summaries = ref<ExperimentSummary[]>([])
  const activeSummary = ref<ExperimentSummary | null>(null)
  const activeResults = ref<ExperimentResults | null>(null)
  const isLoading = ref(false)
  const isLoadingResults = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(projectId: string) {
    isLoading.value = true
    error.value = null
    try {
      summaries.value = await api.listExperiments(projectId)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load experiments'
      summaries.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchOne(expId: string) {
    isLoading.value = true
    error.value = null
    try {
      activeSummary.value = await api.getExperiment(expId)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load experiment'
      activeSummary.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStatus(expId: string): Promise<ExperimentStatusResponse | null> {
    try {
      return await api.getExperimentStatus(expId)
    } catch {
      return null
    }
  }

  async function fetchResults(expId: string) {
    isLoadingResults.value = true
    error.value = null
    try {
      activeResults.value = await api.getExperimentResults(expId)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load results'
      activeResults.value = null
    } finally {
      isLoadingResults.value = false
    }
  }

  function reset() {
    summaries.value = []
    activeSummary.value = null
    activeResults.value = null
    error.value = null
  }

  return {
    summaries, activeSummary, activeResults,
    isLoading, isLoadingResults, error,
    fetchAll, fetchOne, fetchStatus, fetchResults, reset
  }
})