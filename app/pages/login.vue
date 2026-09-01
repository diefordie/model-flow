<script setup lang="ts">
/**
 * /login — email + password auth against Supabase.
 *
 * Tabs for Sign in / Sign up. Both call the same Supabase auth endpoint
 * with different grant types. After success, redirect to /dashboard.
 */
definePageMeta({ layout: 'auth' })

const auth = useAuth()
const route = useRoute()
const router = useRouter()
const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')

if (auth.isAuthenticated.value) {
  await navigateTo((route.query.redirect as string) || '/dashboard')
}

async function submit() {
  if (mode.value === 'signin') {
    const ok = await auth.signIn(email.value, password.value)
    if (ok) await router.push((route.query.redirect as string) || '/dashboard')
    return
  }
  // Sign-up
  const result = await auth.signUp(email.value, password.value)
  if (result.ok) {
    await router.push((route.query.redirect as string) || '/dashboard')
    return
  }
  // If the email is already registered, flip to "Sign in" tab and
  // pre-fill the email so the user can retry with their password.
  if (result.code === 'USER_EXISTS') {
    mode.value = 'signin'
  }
}

onMounted(() => {
  // Test-mode seeding: ?seed_jwt= + &seed_email= writes to localStorage then
  // redirects. Lets headless tests log in without a real signup flow.
  const seedJwt = route.query.seed_jwt as string | undefined
  const seedEmail = route.query.seed_email as string | undefined
  if (seedJwt && seedEmail) {
    try {
      const payload = JSON.parse(atob(seedJwt.split('.')[1]))
      auth.setSession({
        access_token: seedJwt,
        refresh_token: '',
        user: {
          id: payload.sub,
          email: seedEmail,
          role: 'authenticated',
          app_metadata: { provider: 'email' },
          user_metadata: {}
        }
      })
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.replace(redirect)
    } catch (e) {
      console.error('[login.onMounted] seed failed:', e)
    }
  }
})
</script>

<template>
  <div class="min-h-screen grid place-items-center bg-ink-50 p-6">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2 mb-8 justify-center">
        <div class="w-8 h-8 rounded-md bg-ink-950 text-white grid place-items-center font-semibold">M</div>
        <span class="text-lg font-semibold tracking-tight">ModelFlow</span>
      </div>

      <div class="surface p-6">
        <!-- tabs -->
        <div class="flex border-b border-ink-200 mb-5 -mx-6 px-6">
          <button
            v-for="m in (['signin', 'signup'] as const)"
            :key="m"
            @click="mode = m"
            :class="[
              'py-2.5 px-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              mode === m
                ? 'border-ink-950 text-ink-950'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            ]"
          >
            {{ m === 'signin' ? 'Sign in' : 'Create account' }}
          </button>
        </div>

        <form @submit.prevent="submit" class="space-y-3">
          <div>
            <label class="label">Email</label>
            <input v-model="email" type="email" required class="input" placeholder="you@example.com" autocomplete="email" />
          </div>
          <div>
            <label class="label">Password</label>
            <input v-model="password" type="password" required minlength="6" class="input" placeholder="••••••••" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" />
          </div>

          <div v-if="auth.error.value" class="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {{ auth.error.value }}
          </div>

          <button type="submit" :disabled="auth.isLoading.value" class="btn-primary w-full">
            {{ auth.isLoading.value ? 'Working…' : (mode === 'signin' ? 'Sign in' : 'Create account') }}
          </button>
        </form>

        <p class="text-[11px] text-ink-500 mt-4 text-center">
          Auth is managed by Supabase. Your token is stored locally and never sent to any third party.
        </p>
      </div>
    </div>
  </div>
</template>