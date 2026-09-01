/**
 * Auth gate — redirect to /login if the user isn't authenticated.
 *
 * In real mode (NUXT_PUBLIC_API_MODE=real) this is enforced for all
 * pages except /login. In mock mode it's a no-op so dev iteration
 * stays frictionless.
 *
 * Runs client-side only: tokens live in localStorage, which is
 * inaccessible to SSR. Letting the SSR pass through avoids a redirect
 * loop; the client middleware below catches the unauth state on
 * hydration and redirects then.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return
  const config = useRuntimeConfig()
  if (config.public.apiMode !== 'real') return
  if (import.meta.server) return
  const auth = useAuth()
  if (!auth.isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})