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
  },

  runtimeConfig: {
    public: {
      // Default = mock. Set to 'real' once the backend Hono service
      // is reachable (npm run dev:api). useApi will use this to switch
      // the primary data source; missing endpoints fall back to mock.
      apiMode: process.env.NUXT_PUBLIC_API_MODE || 'mock',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    }
  },

  routeRules: {
    // Proxy /api/v1/* → http://localhost:3001/api/v1/* in dev so the
    // browser doesn't have to handle CORS. In prod, set the upstream
    // via NUXT_PUBLIC_API_PROXY_TARGET at build time.
    '/api/v1/**': {
      proxy: process.env.NUXT_PUBLIC_API_PROXY_TARGET || 'http://localhost:3001/api/v1/**'
    }
  }
})