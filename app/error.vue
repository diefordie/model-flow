<script setup lang="ts">
/**
 * 404 — both for unknown routes and unknown projects inside /projects/:id.
 */
</script>

<template>
  <div class="p-12 text-center">
    <p class="text-xs font-mono uppercase tracking-wider text-ink-400 mb-2">404</p>
    <h1 class="text-2xl font-semibold tracking-tight mb-2">Page not found</h1>
    <p class="text-sm text-ink-500 mb-6">The thing you were looking for isn't here.</p>
    <NuxtLink to="/dashboard" class="btn-primary">Back to dashboard</NuxtLink>
  </div>
</template>