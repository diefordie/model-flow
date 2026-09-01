/**
 * Dashboard store.
 *
 * Holds the dashboards for a project + the active dashboard (the one
 * being edited/viewed). Layout is just a list of widgets with x/y/w/h
 * positions on a 12-column grid. The backend resolves widget data
 * server-side; we just render what comes back.
 *
 * Per PRD §07 §4: backend never sends HTML or images — only structured
 * widget data; the frontend owns rendering. Adding a new widget type
 * means a new switch case in `DashboardWidget.vue`, no backend change.
 */

import { defineStore } from 'pinia'
import type { Dashboard, DashboardWidget, InsightDescriptor, TaskType } from '~/types/api'

export const useDashboardStore = defineStore('dashboard', () => {
  const api = useApi()

  const dashboards = ref<Dashboard[]>([])
  const activeDashboard = ref<Dashboard | null>(null)
  const availableInsights = ref<InsightDescriptor[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(projectId: string) {
    isLoading.value = true
    error.value = null
    try {
      dashboards.value = await api.listDashboards(projectId)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load dashboards'
      dashboards.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchOne(dashId: string) {
    isLoading.value = true
    error.value = null
    try {
      activeDashboard.value = await api.getDashboard(dashId)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load dashboard'
      activeDashboard.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function fetchInsights(projectId: string, taskType?: TaskType) {
    try {
      const res = await api.listInsights(projectId, taskType)
      availableInsights.value = res.insights
    } catch {
      availableInsights.value = []
    }
  }

  async function create(projectId: string, name: string, description = ''): Promise<Dashboard> {
    isSaving.value = true
    try {
      const dash = await api.createDashboard(projectId, { name, description })
      dashboards.value = [dash, ...dashboards.value]
      return dash
    } finally {
      isSaving.value = false
    }
  }

  async function persistLayout() {
    if (!activeDashboard.value) return
    isSaving.value = true
    try {
      activeDashboard.value = await api.updateDashboard(activeDashboard.value.id, {
        widgets: activeDashboard.value.widgets
      })
    } finally {
      isSaving.value = false
    }
  }

  async function remove(dashId: string) {
    await api.deleteDashboard(dashId)
    dashboards.value = dashboards.value.filter(d => d.id !== dashId)
    if (activeDashboard.value?.id === dashId) activeDashboard.value = null
  }

  function addWidget(widget: DashboardWidget) {
    if (!activeDashboard.value) return
    activeDashboard.value.widgets.push(widget)
  }

  function removeWidget(widgetId: string) {
    if (!activeDashboard.value) return
    activeDashboard.value.widgets = activeDashboard.value.widgets.filter(w => w.id !== widgetId)
  }

  function reset() {
    dashboards.value = []
    activeDashboard.value = null
    availableInsights.value = []
    error.value = null
  }

  return {
    dashboards, activeDashboard, availableInsights,
    isLoading, isSaving, error,
    fetchAll, fetchOne, fetchInsights,
    create, persistLayout, remove,
    addWidget, removeWidget, reset
  }
})