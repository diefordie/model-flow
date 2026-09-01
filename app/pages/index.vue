<script setup lang="ts">
/**
 * Landing route. PRD §6.1:
 *   `/` — Landing / redirect (to `/dashboard` if authenticated)
 *
 * MVP shortcut: always redirect to /dashboard. Real auth gate (Supabase)
 * will be wired when backend role lands.
 */
definePageMeta({ layout: false })
await navigateTo('/dashboard', { replace: true })
</script>

<template>
  <div />
</template>