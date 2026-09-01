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

  async function signUp(email: string, password: string): Promise<{ ok: true } | { ok: false; code: string }> {
    isLoading.value = true
    error.value = null
    try {
      const config = useRuntimeConfig()
      const isReal = config.public.apiMode === 'real'

      if (isReal) {
        // Real mode: hit our backend's POST /auth/signup which admin-creates
        // the user with email_confirm=true and returns a ready-to-use session.
        // (Direct Supabase signup returns no access_token when email confirmation
        // is enabled, so the user is stuck on "check your email" forever.)
        const r = await fetch('/api/v1/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const body = await r.json()
        if (!r.ok) {
          const code = body?.error?.code ?? 'SIGNUP_FAILED'
          const msg = body?.error?.message ?? body?.message ?? 'Signup failed'
          error.value = code === 'USER_EXISTS'
            ? 'An account with this email already exists. Try signing in instead.'
            : msg
          return { ok: false, code }
        }
        const s: AuthSession = {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + body.expires_in,
          user: { id: body.user.id, email: body.user.email }
        }
        session.value = s
        persist(s)
        return { ok: true }
      }

      // Mock mode: hit Supabase directly (kept for offline / dev).
      const r = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const body = await r.json()
      if (!r.ok) {
        const code = body?.error_code ?? 'SIGNUP_FAILED'
        error.value = body?.msg ?? body?.error_description ?? body?.message ?? 'Signup failed'
        return { ok: false, code }
      }
      if (body.access_token) {
        const s: AuthSession = {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: body.expires_at ?? (Math.floor(Date.now() / 1000) + body.expires_in),
          user: { id: body.user.id, email: body.user.email }
        }
        session.value = s
        persist(s)
        return { ok: true }
      }
      error.value = 'Check your email to confirm your account, then log in.'
      return { ok: false, code: 'EMAIL_CONFIRM_REQUIRED' }
    } catch (e: any) {
      error.value = e?.message ?? 'Network error'
      return { ok: false, code: 'NETWORK_ERROR' }
    } finally {
      isLoading.value = false
    }
  }

  /** Externally set a session (e.g. test-mode seed_jwt query param).
   *  Stores in localStorage and updates reactive state. */
  function setSession(s: { access_token: string; refresh_token: string; user: AuthUser }) {
    const next: AuthSession = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1h default
      user: { id: s.user.id, email: s.user.email }
    }
    session.value = next
    persist(next) // persist takes a plain object, not the ref
  }

  async function signOut() {
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
    signIn, signUp, signOut, setSession, getToken
  }
}