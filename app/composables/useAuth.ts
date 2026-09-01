/**
 * useAuth — Supabase email/password auth.
 *
 * Token lives in localStorage so SSR pages that don't have the token
 * still render (they just show "log in" gate). On the client, every
 * useApi() call auto-attaches the bearer token.
 */
const STORAGE_KEY = 'modelflow:auth'

interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number  // unix seconds
  user: { id: string; email: string | null }
}

export const useAuth = () => {
  const session = useState<AuthSession | null>('auth-session', () => null)
  const isLoading = useState<boolean>('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl as string
  const supabaseKey = config.public.supabaseAnonKey as string

  // ── Hydrate from localStorage on client ─────────────────────────────
  if (import.meta.client && session.value === null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AuthSession
        if (parsed.expires_at * 1000 > Date.now()) session.value = parsed
        else localStorage.removeItem(STORAGE_KEY)
      }
    } catch { /* corrupt storage; ignore */ }
  }

  const persist = (s: AuthSession | null) => {
    if (import.meta.client) {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      else localStorage.removeItem(STORAGE_KEY)
    }
  }

  const isAuthenticated = computed(() => !!session.value)

  async function signIn(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const body = await r.json()
      if (!r.ok) {
        error.value = body?.msg ?? body?.error_description ?? body?.message ?? 'Login failed'
        return false
      }
      const s: AuthSession = {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: body.expires_at ?? (Math.floor(Date.now() / 1000) + body.expires_in),
        user: { id: body.user.id, email: body.user.email }
      }
      session.value = s
      persist(s)
      return true
    } catch (e: any) {
      error.value = e?.message ?? 'Network error'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function signUp(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const body = await r.json()
      if (!r.ok) {
        error.value = body?.msg ?? body?.error_description ?? body?.message ?? 'Signup failed'
        return false
      }
      // Supabase may require email confirmation; if a session is returned
      // (anon-friendly or confirmation disabled), log the user in directly.
      if (body.access_token) {
        const s: AuthSession = {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: body.expires_at ?? (Math.floor(Date.now() / 1000) + body.expires_in),
          user: { id: body.user.id, email: body.user.email }
        }
        session.value = s
        persist(s)
        return true
      }
      error.value = 'Check your email to confirm your account, then log in.'
      return false
    } catch (e: any) {
      error.value = e?.message ?? 'Network error'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function signOut() {
    session.value = null
    persist(null)
    navigateTo('/login')
  }

  function getToken(): string | null {
    return session.value?.access_token ?? null
  }

  return {
    session: readonly(session),
    user: computed(() => session.value?.user ?? null),
    isAuthenticated,
    isLoading: readonly(isLoading),
    error: readonly(error),
    signIn, signUp, signOut, getToken
  }
}