import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app.vue',
    './app/**/*.{vue,ts,js}',
    './pages/**/*.{vue,ts,js}',
    './components/**/*.{vue,ts,js}',
    './layouts/**/*.{vue,ts,js}',
    './composables/**/*.{ts,js}',
    './stores/**/*.{ts,js}'
  ],
  theme: {
    extend: {
      colors: {
        // ModelFlow brand: cool, professional, tool-oriented.
        // Distinct from Dii's portfolio (cream + forest + yellow).
        ink: {
          950: '#0A0F1C',  // deep navy (sidebar, text-on-light)
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50:  '#F8FAFC'
        },
        accent: {
          // electric indigo — tool UI affordance
          DEFAULT: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          50:  '#EEF2FF'
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger:  '#EF4444'
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        'panel': '0 1px 0 0 rgba(15,23,42,0.04), 0 1px 2px 0 rgba(15,23,42,0.06)',
        'lift':  '0 8px 24px -8px rgba(15,23,42,0.18), 0 2px 6px -2px rgba(15,23,42,0.06)'
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fade-in 240ms ease-out both'
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  }
}