<script setup lang="ts">
/**
 * `/projects/new` — Create project.
 *
 * PRD §6.1: form with Project Name (required), Description (optional),
 * optional project type. On success, redirect to `/projects/:id`.
 */
const store = useProjectStore()

const name = ref('')
const description = ref('')
const submitting = ref(false)
const fieldError = ref<string | null>(null)

const trimmedName = computed(() => name.value.trim())

async function submit() {
  fieldError.value = null
  if (!trimmedName.value) {
    fieldError.value = 'Project name is required.'
    return
  }
  submitting.value = true
  try {
    const created = await store.create({ name: trimmedName.value, description: description.value.trim() || undefined })
    await navigateTo(`/projects/${created.id}`)
  } catch (e: any) {
    fieldError.value = e?.message ?? 'Failed to create project.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="p-8 max-w-xl">
    <header class="mb-6">
      <NuxtLink to="/projects" class="text-xs text-ink-500 hover:text-ink-900 mb-2 inline-block">← Back to projects</NuxtLink>
      <h1 class="text-2xl font-semibold tracking-tight">New project</h1>
      <p class="text-sm text-ink-500 mt-1">Give your project a name. You can add a dataset and configure a model right after.</p>
    </header>

    <form @submit.prevent="submit" class="surface p-6 space-y-4">
      <div>
        <label for="name" class="label">Project name <span class="text-danger">*</span></label>
        <input
          id="name"
          v-model="name"
          class="input"
          placeholder="e.g. Diabetes Prediction"
          autocomplete="off"
          :disabled="submitting"
          autofocus
          required
        />
      </div>

      <div>
        <label for="description" class="label">Description <span class="text-ink-400 font-normal">(optional)</span></label>
        <textarea
          id="description"
          v-model="description"
          class="input min-h-24 h-auto py-2 resize-none"
          placeholder="What is this project about?"
          :disabled="submitting"
        />
      </div>

      <div v-if="fieldError" class="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {{ fieldError }}
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button type="submit" class="btn-primary" :disabled="submitting || !trimmedName">
          {{ submitting ? 'Creating…' : 'Create project' }}
        </button>
        <NuxtLink to="/projects" class="btn-ghost">Cancel</NuxtLink>
      </div>
    </form>
  </div>
</template>