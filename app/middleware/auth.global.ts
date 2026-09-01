/**
 * Auth gate — redirect to /login if the user isn't authenticated.
 *
 * In real mode (NUXT_PUBLIC_API_MODE=real) this is enforced for all
 * pages except /login. In mock mode it's a no-op so dev iteration
 * stays frictionless.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return
  const config = useRuntimeConfig()
  if (config.public.apiMode !== 'real') return
  const auth = useAuth()
  if (!auth.isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})