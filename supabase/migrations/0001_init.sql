-- ModelFlow initial schema.
-- References:
--   - PRD: ~/ai-must-know/01-Projects/ModelFlow/03-database-schema.md
--   - supabase-postgres-best-practices (security-rls-basics, schema-primary-keys,
--     lock-skip-locked, query-composite-indexes).
--
-- Rules enforced:
--   * bigint identity PKs (sequential, index-friendly) — not random UUIDs.
--   * All user-owned tables RLS-enabled + forced, policy = owner_id = auth.uid().
--   * Queue uses `for update skip locked` (see apps/worker).
--   * Composite indexes for common filter shapes.

create extension if not exists pgcrypto;

-- =========================================================================
-- Enums
-- =========================================================================
do $$ begin
  create type project_status as enum ('draft','active','completed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type experiment_status as enum ('queued','running','completed','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type optimization_method as enum ('manual','grid_search','random_search');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_type as enum ('classification','regression','clustering');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_type as enum ('profiling','training');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- projects
-- =========================================================================
create table if not exists projects (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      project_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on projects (owner_id);

alter table projects enable row level security;
alter table projects force row level security;

drop policy if exists projects_owner_policy on projects;
create policy projects_owner_policy on projects
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =========================================================================
-- datasets
-- =========================================================================
create table if not exists datasets (
  id           bigint generated always as identity primary key,
  project_id   bigint not null references projects(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  file_path    text not null,
  file_type    text not null check (file_type in ('csv','xlsx')),
  file_size    bigint not null,
  row_count    integer,
  column_count integer,
  schema       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists datasets_project_id_idx on datasets (project_id);
create index if not exists datasets_owner_id_idx on datasets (owner_id);

alter table datasets enable row level security;
alter table datasets force row level security;

drop policy if exists datasets_owner_policy on datasets;
create policy datasets_owner_policy on datasets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =========================================================================
-- dataset_columns
-- =========================================================================
create table if not exists dataset_columns (
  id            bigint generated always as identity primary key,
  dataset_id    bigint not null references datasets(id) on delete cascade,
  name          text not null,
  data_type     text not null check (data_type in ('number','binary','categorical','text','datetime')),
  nullable      boolean not null default true,
  unique_count  integer,
  missing_count integer,
  statistics    jsonb
);

create index if not exists dataset_columns_dataset_id_idx on dataset_columns (dataset_id);

alter table dataset_columns enable row level security;
alter table dataset_columns force row level security;

-- RLS: must match parent dataset's owner.
drop policy if exists dataset_columns_owner_policy on dataset_columns;
create policy dataset_columns_owner_policy on dataset_columns
  for all to authenticated
  using (exists (
    select 1 from datasets d
    where d.id = dataset_columns.dataset_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from datasets d
    where d.id = dataset_columns.dataset_id and d.owner_id = auth.uid()
  ));

-- =========================================================================
-- experiments
-- =========================================================================
create table if not exists experiments (
  id               bigint generated always as identity primary key,
  project_id       bigint not null references projects(id) on delete cascade,
  dataset_id       bigint not null references datasets(id) on delete restrict,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  task_type        task_type not null,
  target_column    text,
  feature_columns  jsonb not null default '[]'::jsonb,
  status           experiment_status not null default 'queued',
  current_stage    text,
  progress         smallint not null default 0 check (progress between 0 and 100),
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists experiments_project_status_idx
  on experiments (project_id, status);
create index if not exists experiments_owner_id_idx on experiments (owner_id);

alter table experiments enable row level security;
alter table experiments force row level security;

drop policy if exists experiments_owner_policy on experiments;
create policy experiments_owner_policy on experiments
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =========================================================================
-- preprocessing_configs (1:1 with experiments)
-- =========================================================================
create table if not exists preprocessing_configs (
  id            bigint generated always as identity primary key,
  experiment_id bigint not null unique references experiments(id) on delete cascade,
  config        jsonb not null
);

alter table preprocessing_configs enable row level security;
alter table preprocessing_configs force row level security;

drop policy if exists preprocessing_configs_owner_policy on preprocessing_configs;
create policy preprocessing_configs_owner_policy on preprocessing_configs
  for all to authenticated
  using (exists (
    select 1 from experiments e
    where e.id = preprocessing_configs.experiment_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from experiments e
    where e.id = preprocessing_configs.experiment_id and e.owner_id = auth.uid()
  ));

-- =========================================================================
-- model_configs (1:1 with experiments)
-- =========================================================================
create table if not exists model_configs (
  id                  bigint generated always as identity primary key,
  experiment_id       bigint not null unique references experiments(id) on delete cascade,
  model_type          text not null,
  hyperparameters     jsonb not null default '{}'::jsonb,
  optimization_method optimization_method not null default 'manual',
  cv_folds            integer,
  scoring             text
);

alter table model_configs enable row level security;
alter table model_configs force row level security;

drop policy if exists model_configs_owner_policy on model_configs;
create policy model_configs_owner_policy on model_configs
  for all to authenticated
  using (exists (
    select 1 from experiments e
    where e.id = model_configs.experiment_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from experiments e
    where e.id = model_configs.experiment_id and e.owner_id = auth.uid()
  ));

-- =========================================================================
-- experiment_metrics (1:many)
-- =========================================================================
create table if not exists experiment_metrics (
  id            bigint generated always as identity primary key,
  experiment_id bigint not null references experiments(id) on delete cascade,
  metric_name   text not null,
  metric_value  double precision not null
);

create index if not exists experiment_metrics_exp_metric_idx
  on experiment_metrics (experiment_id, metric_name);

alter table experiment_metrics enable row level security;
alter table experiment_metrics force row level security;

drop policy if exists experiment_metrics_owner_policy on experiment_metrics;
create policy experiment_metrics_owner_policy on experiment_metrics
  for all to authenticated
  using (exists (
    select 1 from experiments e
    where e.id = experiment_metrics.experiment_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from experiments e
    where e.id = experiment_metrics.experiment_id and e.owner_id = auth.uid()
  ));

-- =========================================================================
-- experiment_results (1:many, chart-ready jsonb)
-- =========================================================================
create table if not exists experiment_results (
  id            bigint generated always as identity primary key,
  experiment_id bigint not null references experiments(id) on delete cascade,
  result_type   text not null,
  result_data   jsonb not null
);

create index if not exists experiment_results_experiment_idx on experiment_results (experiment_id);

alter table experiment_results enable row level security;
alter table experiment_results force row level security;

drop policy if exists experiment_results_owner_policy on experiment_results;
create policy experiment_results_owner_policy on experiment_results
  for all to authenticated
  using (exists (
    select 1 from experiments e
    where e.id = experiment_results.experiment_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from experiments e
    where e.id = experiment_results.experiment_id and e.owner_id = auth.uid()
  ));

-- =========================================================================
-- dashboards (project-level, can back to many experiments)
-- =========================================================================
create table if not exists dashboards (
  id            bigint generated always as identity primary key,
  project_id    bigint not null references projects(id) on delete cascade,
  experiment_id bigint not null references experiments(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  layout        jsonb not null default '{}'::jsonb,
  insights      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists dashboards_project_id_idx on dashboards (project_id);
create index if not exists dashboards_owner_id_idx on dashboards (owner_id);

alter table dashboards enable row level security;
alter table dashboards force row level security;

drop policy if exists dashboards_owner_policy on dashboards;
create policy dashboards_owner_policy on dashboards
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =========================================================================
-- experiment_jobs (queue table — worker polls this)
-- =========================================================================
create table if not exists experiment_jobs (
  id            bigint generated always as identity primary key,
  type          job_type not null,
  experiment_id bigint references experiments(id) on delete cascade,
  dataset_id    bigint references datasets(id) on delete cascade,
  status        experiment_status not null default 'queued',
  payload       jsonb not null default '{}'::jsonb,
  claimed_at    timestamptz,
  claimed_by    text,
  error         text,
  created_at    timestamptz not null default now()
);

-- Composite index for the worker's claim query:
--   WHERE status='queued' AND type=$TYPE ORDER BY created_at LIMIT 1
create index if not exists experiment_jobs_status_type_created_idx
  on experiment_jobs (status, type, created_at);

-- Queue table is internal; worker uses service-role key and bypasses RLS.
-- We still enable RLS so anon/authenticated can never poke it.
alter table experiment_jobs enable row level security;
alter table experiment_jobs force row level security;

drop policy if exists experiment_jobs_no_access on experiment_jobs;
create policy experiment_jobs_no_access on experiment_jobs
  for all to authenticated using (false) with check (false);

-- =========================================================================
-- model_artifacts (1:1 with experiments)
-- =========================================================================
create table if not exists model_artifacts (
  experiment_id bigint primary key references experiments(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  storage_path  text not null,
  bytes         bigint not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table model_artifacts enable row level security;
alter table model_artifacts force row level security;

drop policy if exists model_artifacts_owner_policy on model_artifacts;
create policy model_artifacts_owner_policy on model_artifacts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =========================================================================
-- updated_at trigger for projects + dashboards
-- =========================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

drop trigger if exists dashboards_set_updated_at on dashboards;
create trigger dashboards_set_updated_at
  before update on dashboards
  for each row execute function set_updated_at();