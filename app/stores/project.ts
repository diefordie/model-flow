/**
 * Project store.
 *
 * Holds the global list of projects and the active project (for nested
 * /projects/[id]/* routes). Per PRD §3.1 "Minimal state domains", only
 * project-level aggregates go here — dataset/experiment state gets its
 * own stores when Sprint 2/3 land.
 */

import { defineStore } from 'pinia'
import type { Project } from '~/types/api'

export const useProjectStore = defineStore('project', () => {
  const api = useApi()

  const projects = ref<Project[]>([])
  const activeProject = ref<Project | null>(null)
  const isLoading = ref(false)
  const isMutating = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    isLoading.value = true
    error.value = null
    try {
      projects.value = await api.listProjects()
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load projects'
      projects.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchOne(id: string) {
    isLoading.value = true
    error.value = null
    try {
      activeProject.value = await api.getProject(id)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load project'
      activeProject.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function create(input: { name: string; description?: string }) {
    isMutating.value = true
    error.value = null
    try {
      const created = await api.createProject(input)
      projects.value.unshift(created)
      return created
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create project'
      throw e
    } finally {
      isMutating.value = false
    }
  }

  async function remove(id: string) {
    isMutating.value = true
    error.value = null
    try {
      await api.deleteProject(id)
      projects.value = projects.value.filter(p => p.id !== id)
      if (activeProject.value?.id === id) activeProject.value = null
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to delete project'
      throw e
    } finally {
      isMutating.value = false
    }
  }

  function clearActive() { activeProject.value = null }

  return {
    projects, activeProject,
    isLoading, isMutating, error,
    fetchAll, fetchOne, create, remove, clearActive
  }
})