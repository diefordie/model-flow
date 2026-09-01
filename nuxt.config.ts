// ModelFlow — Nuxt 4 frontend
// Stack: Nuxt + Tailwind + Pinia. Supabase wiring handled by backend role.
// Until backend+Supabase ready, all API calls route through `composables/useApi.ts`
// which falls back to in-memory mocks so the UI is exercisable end-to-end.

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'ModelFlow — Configure once, reproduce anywhere',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'ModelFlow: a structured visual workspace for data scientists. Configure a model once, reproduce the result anywhere.' }
      ]
    }
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts'
  },

  typescript: {
    strict: true,
    typeCheck: false
  }
})