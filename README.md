# ModelFlow — Frontend (Sprint 1)

Nuxt 4 frontend for [ModelFlow PRD](../01-Projects/ModelFlow/00-INDEX.md).
This implements **Sprint 1** of the frontend roadmap: layout, sidebar,
project list, create project, project overview.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Nuxt 4.5+ | File-based routing, auto-imports, SSR by default |
| State | Pinia 2.x | Aligns with `@pinia/nuxt` peer-deps |
| Styling | Tailwind CSS 3 | Utility-first, custom `ink` palette for tool feel |
| Mock API | In-memory via `useApi.ts` | Backend role still wiring Supabase + Hono |

## Run

```bash
npm install --legacy-peer-deps   # pinia 3.x conflicts with @pinia/nuxt@0.9
npm run dev
# → http://localhost:3000 (or 3001 if 3000 busy)
```

## Architecture

```
app/
├── app.vue                    # root
├── error.vue                  # 404 / error boundary
├── layouts/default.vue        # top bar + drawer sidebar + content
├── pages/
│   ├── index.vue              # redirects to /dashboard
│   ├── dashboard.vue          # global overview
│   └── projects/
│       ├── index.vue          # project list + filter tabs
│       ├── new.vue            # create project form
│       └── [id]/
│           ├── index.vue      # project overview
│           ├── dataset.vue    # → Sprint 2
│           ├── pipeline.vue   # → Sprint 3
│           ├── experiments.vue# → Sprint 4
│           ├── dashboard.vue  # → Sprint 5
│           └── predictions.vue# → Sprint 6
├── components/ComingSoon.vue  # honest placeholder for sub-nav routes
├── composables/useApi.ts      # mock API swap-point for real backend
├── stores/project.ts          # Pinia store: projects + activeProject
├── types/api.ts               # shared TS types matching `04-api-reference.md`
├── utils/format.ts            # tiny date helpers (stdlib Intl only)
└── assets/css/main.css        # Tailwind + base components
```

## Connecting to the real backend

When Juru/Lunas finish the Hono + Supabase backend, flip `USE_MOCK` to
`false` in `app/composables/useApi.ts`. The request shape already
matches `04-api-reference.md` §1–§7 verbatim.

```ts
// useApi.ts
const USE_MOCK = false  // ← flip when backend green
```

The `request()` helper does the JSON envelope unwrap
(`{ success, data, error }`) so individual call sites stay clean.

## UX States

Every async surface implements all four states per PRD §3.1 / §8.3:

- **Loading** — `animate-pulse-soft` skeletons on cards
- **Empty** — illustration + headline + primary CTA
- **Error** — red surface with backend message + retry
- **Success** — populated content + status badges

## Sprint status

| Sprint | Scope | Status |
|---|---|---|
| 1 | Foundation (layout, sidebar, project CRUD, overview) | ✅ done |
| 2 | Dataset (upload, preview, profiling) | — coming |
| 3 | Pipeline (task/target/feature/preprocessing/model/hyperparams) | — coming |
| 4 | Experiments (training progress, results, history) | — coming |
| 5 | Dashboards (insight selector, chart components, grid) | — coming |
| 6 | Predictions (form, result, probability viz) | — coming |
| 7 | Polish (errors, validation, responsive, a11y, perf, docs) | — coming |

## Design notes

- **Brand identity** is cool/professional (`ink-950` + `accent` indigo),
  deliberately distinct from Dii's portfolio (`cream + forest + yellow`).
  This is a tool, not a personal site.
- **Bento featured card** on project overview signals the highest-leverage
  next action ("Configure your pipeline") with a subtle data-stripe pattern.
- **Mobile** uses a hamburger drawer (≤ 767px); desktop keeps persistent
  sidebar. Stats cards collapse to single column under sm.
- **Sub-nav placeholder** ("soon" tag) tells users Sprint 2+ routes exist
  and will be filled, instead of pretending the page is fully built.