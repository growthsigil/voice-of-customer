-- ============================================================================
-- Voice of Customer — database schema (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- Run once in the Supabase SQL editor on a fresh project. Idempotent.
--
-- Tables:
--   calls          — the memory base: one row per sales call (transcript + meta)
--   call_insights  — the AI's structured read of each call (objections, fears,
--                    pain points, questions, avatar signals, quotes)
--   reports        — the weekly compiled report (structured JSON + Markdown)
--   events         — a light audit log
-- ============================================================================

create extension if not exists pgcrypto with schema public;


-- ── calls ───────────────────────────────────────────────────────────────────
create table if not exists public.calls (
    id uuid not null default gen_random_uuid(),
    external_id text,                         -- Fathom meeting/recording id (dedup)
    source text not null default 'fathom',
    title text,
    call_date timestamp with time zone,
    attendees jsonb not null default '[]'::jsonb,
    duration_minutes integer,
    recording_url text,
    transcript text,
    summary text,
    raw jsonb,                                -- the untouched inbound payload
    status text not null default 'received',  -- received | analyzed | failed | skipped
    analyzed_at timestamp with time zone,
    error text,
    created_at timestamp with time zone not null default now()
);

do $$ begin
    alter table public.calls add constraint calls_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $$;
-- Dedup on external_id when present (a Fathom re-delivery won't double-insert).
create unique index if not exists calls_external_id_uniq on public.calls (external_id) where (external_id is not null);
create index if not exists calls_status_idx on public.calls (status);
create index if not exists calls_date_idx on public.calls (call_date desc);


-- ── call_insights ───────────────────────────────────────────────────────────
-- One row per analyzed call. Arrays hold {label/text, quote, ...} objects so the
-- weekly compile can cluster and count them across calls.
create table if not exists public.call_insights (
    id uuid not null default gen_random_uuid(),
    call_id uuid not null,
    objections jsonb not null default '[]'::jsonb,     -- [{label, concern, quote}]
    fears jsonb not null default '[]'::jsonb,          -- [{label, quote}]
    pain_points jsonb not null default '[]'::jsonb,    -- [{label, quote}]
    questions jsonb not null default '[]'::jsonb,      -- [{question, quote}]
    avatar jsonb not null default '{}'::jsonb,         -- {role, industry, stage, goals, situation, triggers, emotional_drivers, budget_signal, awareness_level, demographics}
    buying_signals jsonb not null default '[]'::jsonb, -- [{label, quote}]
    notable_quotes jsonb not null default '[]'::jsonb, -- ["..."]
    voc_language jsonb not null default '[]'::jsonb,   -- ["phrases they actually used"]
    model_used text,
    created_at timestamp with time zone not null default now()
);

do $$ begin
    alter table public.call_insights add constraint call_insights_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $$;
do $$ begin
    alter table public.call_insights add constraint call_insights_call_id_fkey FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $$;
create unique index if not exists call_insights_call_uniq on public.call_insights (call_id);


-- ── reports ─────────────────────────────────────────────────────────────────
create table if not exists public.reports (
    id uuid not null default gen_random_uuid(),
    period_start date not null,
    period_end date not null,
    calls_count integer not null default 0,
    title text,
    content_json jsonb not null default '{}'::jsonb,   -- the structured report
    content_md text,                                   -- Markdown version (paste anywhere)
    status text not null default 'ready',              -- ready | empty | failed
    model_used text,
    created_at timestamp with time zone not null default now()
);

do $$ begin
    alter table public.reports add constraint reports_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $$;
create index if not exists reports_created_idx on public.reports (created_at desc);


-- ── events (light audit log) ────────────────────────────────────────────────
create table if not exists public.events (
    id uuid not null default gen_random_uuid(),
    event_type text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default now()
);

do $$ begin
    alter table public.events add constraint events_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $$;
create index if not exists events_type_time_idx on public.events (event_type, created_at desc);


-- ── Row-Level Security (server uses service_role and bypasses RLS) ──────────
alter table public.calls         enable row level security;
alter table public.call_insights enable row level security;
alter table public.reports       enable row level security;
alter table public.events        enable row level security;

-- ============================================================================
-- END. Point Fathom at /api/webhook/fathom and the calls start flowing in.
-- ============================================================================
