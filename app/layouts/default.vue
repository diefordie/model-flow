<script setup lang="ts">
/**
 * Global app shell for ModelFlow.
 *
 * PRD §2.5 (Application Layout):
 *   ┌─────────────────────────────────────────────────────┐
 *   │ ModelFlow                         User / Settings   │
 *   ├──────────────┬──────────────────────────────────────┤
 *   │ Dashboard    │                                      │
 *   │ Projects     │            Main Content              │
 *   │              │                                      │
 *   └──────────────┴──────────────────────────────────────┘
 *
 * Top bar + persistent left sidebar. The sidebar is GLOBAL navigation;
 * inside a project the right pane gets a secondary sub-nav rendered by
 * `pages/projects/[id].vue` (PRD §2.5 second diagram).
 *
 * Skip: dragging the sidebar to a collapsible icon-rail mode. Add when
 *   the design system can support keyboard-revealed labels (Phase 2).
 */
const route = useRoute()
const isMobile = ref(false)
const isOpen = ref(false)
const userMenuOpen = ref(false)
const userMenu = ref<HTMLElement | null>(null)
const auth = useAuth()
const api = useApi()

const userInitials = computed(() => {
  const email = auth.user.value?.email ?? ''
  const name = email.split('@')[0] ?? '?'
  return name.slice(0, 2).toUpperCase()
})

function handleUserMenuClickOutside(e: MouseEvent) {
  if (!userMenu.value) return
  if (!(userMenu.value as HTMLElement).contains(e.target as Node)) userMenuOpen.value = false
}
if (import.meta.client) {
  onMounted(() => document.addEventListener('click', handleUserMenuClickOutside))
  onBeforeUnmount(() => document.removeEventListener('click', handleUserMenuClickOutside))
}
const mobileNavOpen = ref(false)

onMounted(() => {
  const mq = window.matchMedia('(max-width: 767px)')
  isMobile.value = mq.matches
  mq.addEventListener('change', e => { isMobile.value = e.matches; if (!e.matches) mobileNavOpen.value = false })
})
// close drawer on route change
watch(() => route.path, () => { mobileNavOpen.value = false })

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/projects',  label: 'Projects',  icon: 'folder' }
]

function isActive(to: string) {
  if (to === '/projects') return route.path === '/projects' || route.path.startsWith('/projects/')
  return route.path === to
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-ink-50">
    <!-- Top bar -->
    <header class="h-14 bg-ink-950 text-white flex items-center justify-between px-4 md:px-6 shrink-0 relative z-30">
      <div class="flex items-center gap-2.5">
        <!-- Hamburger (mobile only) -->
        <button
          v-if="isMobile"
          @click="mobileNavOpen = !mobileNavOpen"
          class="md:hidden w-9 h-9 -ml-1 grid place-items-center rounded-md hover:bg-ink-800 text-ink-300 hover:text-white"
          aria-label="Toggle navigation"
          :aria-expanded="mobileNavOpen"
        >
          <svg v-if="!mobileNavOpen" viewBox="0 0 20 20" fill="none" class="w-5 h-5"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <svg v-else viewBox="0 0 20 20" fill="none" class="w-5 h-5"><path d="M5 5l10 10M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>

        <NuxtLink to="/dashboard" class="flex items-center gap-2.5 group">
          <span class="w-7 h-7 rounded-md bg-accent grid place-items-center font-bold text-sm">M</span>
          <span class="font-semibold tracking-tight text-[15px]">ModelFlow</span>
          <span class="text-[11px] text-ink-400 font-mono hidden sm:inline">v1.1</span>
        </NuxtLink>
      </div>

      <nav class="flex items-center gap-1 text-sm">
        <button class="px-2.5 md:px-3 h-9 rounded-md hover:bg-ink-800 text-ink-300 hover:text-white transition-colors flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
          <span class="hidden md:inline">Worker online</span>
        </button>
        <span :class="['text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded',
                       api.mode === 'real' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-ink-800 text-ink-400']">
          {{ api.mode }}
        </span>
        <div v-if="auth.isAuthenticated.value" class="w-px h-5 bg-ink-800 mx-1 md:mx-2 hidden sm:block" />
        <ClientOnly>
          <div v-if="auth.isAuthenticated.value" class="relative" ref="userMenu">
            <button @click="userMenuOpen = !userMenuOpen" class="flex items-center gap-2 pl-1 pr-2 h-9 rounded-md hover:bg-ink-800 text-ink-300 hover:text-white transition-colors" aria-label="User menu">
              <span class="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-600 grid place-items-center text-xs font-semibold">
                {{ (auth.session.value?.user?.email || '?').charAt(0).toUpperCase() }}
              </span>
              <span class="text-sm hidden md:inline">{{ auth.session.value?.user?.email }}</span>
            </button>
            <div v-if="userMenuOpen" class="absolute right-0 top-11 w-56 bg-white text-ink-900 rounded-md border border-ink-200 shadow-lift py-1 text-sm">
              <div class="px-3 py-2 border-b border-ink-100 text-xs text-ink-500 truncate">{{ auth.session.value?.user?.email }}</div>
              <button @click="auth.signOut" class="w-full text-left px-3 py-1.5 hover:bg-ink-100">Sign out</button>
            </div>
          </div>
          <template #fallback>
            <!-- SSR fallback: empty span keeps the bar height stable -->
            <span class="w-7 h-7 inline-block" />
          </template>
        </ClientOnly>
        <button class="w-9 h-9 rounded-md hover:bg-ink-800 grid place-items-center text-ink-300 hover:text-white hidden sm:grid" aria-label="Settings">
          <svg viewBox="0 0 20 20" fill="none" class="w-4 h-4"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"/><path d="M16.4 12.4l1.3 1.1-1.7 3-1.6-.5a6.4 6.4 0 01-1.6.9l-.3 1.6h-3.4l-.3-1.6a6.4 6.4 0 01-1.6-.9l-1.6.5-1.7-3 1.3-1.1a6.4 6.4 0 010-1.8l-1.3-1.1 1.7-3 1.6.5a6.4 6.4 0 011.6-.9l.3-1.6h3.4l.3 1.6a6.4 6.4 0 011.6.9l1.6-.5 1.7 3-1.3 1.1a6.4 6.4 0 010 1.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button class="w-9 h-9 rounded-full bg-accent grid place-items-center font-semibold text-sm" aria-label="User menu">
          D
        </button>
      </nav>
    </header>

    <!-- Mobile drawer backdrop -->
    <Transition name="fade">
      <div
        v-if="isMobile && mobileNavOpen"
        @click="mobileNavOpen = false"
        class="md:hidden fixed inset-0 bg-ink-950/40 z-40"
      />
    </Transition>

    <!-- Body: sidebar (desktop) / drawer (mobile) + content -->
    <div class="flex-1 flex min-h-0 relative">
      <!-- Desktop sidebar -->
      <aside v-if="!isMobile" class="w-56 shrink-0 border-r border-ink-200 bg-white">
        <nav class="p-3 space-y-0.5">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="[
              'flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium transition-colors',
              isActive(item.to)
                ? 'bg-ink-950 text-white'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
            ]"
          >
            <span class="w-4 h-4 grid place-items-center shrink-0" aria-hidden="true">
              <svg v-if="item.icon === 'grid'" viewBox="0 0 16 16" fill="none" class="w-4 h-4">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <svg v-else viewBox="0 0 16 16" fill="none" class="w-4 h-4">
                <path d="M3 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3 8h10" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </span>
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="px-3 mt-6">
          <div class="px-3 py-2.5 rounded-lg border border-ink-200 bg-ink-50/60 text-[11px] text-ink-500 leading-snug flex items-center gap-2">
            <kbd class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-ink-200 text-ink-700">⌘K</kbd>
            <span>Quick switcher</span>
          </div>
        </div>
      </aside>

      <!-- Mobile drawer -->
      <Transition name="slide">
        <aside
          v-if="isMobile && mobileNavOpen"
          class="md:hidden fixed inset-y-0 left-0 w-64 bg-white border-r border-ink-200 z-50 flex flex-col pt-14"
        >
          <nav class="p-3 space-y-0.5">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              :class="[
                'flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-medium transition-colors',
                isActive(item.to)
                  ? 'bg-ink-950 text-white'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              ]"
            >
              <span class="w-4 h-4 grid place-items-center shrink-0" aria-hidden="true">
                <svg v-if="item.icon === 'grid'" viewBox="0 0 16 16" fill="none" class="w-4 h-4">
                  <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <svg v-else viewBox="0 0 16 16" fill="none" class="w-4 h-4">
                  <path d="M3 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M3 8h10" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </span>
              {{ item.label }}
            </NuxtLink>
          </nav>
        </aside>
      </Transition>

      <!-- Main content -->
      <main class="flex-1 min-w-0 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 240ms cubic-bezier(0.32, 1, 0.45, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>