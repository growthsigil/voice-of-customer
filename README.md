[README 5.md](https://github.com/user-attachments/files/31813231/README.5.md)
# Voice of Customer

**Turn your Fathom sales calls into a weekly report of what your prospects
actually say - ready for content.**

Every call flows in, gets read by Claude for the prospect's **objections, fears,
pain points, and questions** plus **who they are**, and once a week it's compiled
into one clear report: the most common of each (with real quotes and content
angles), a detailed **ideal-client profile**, a **voice-of-customer language
bank**, and **content ideas** built from it all.

```
  Fathom call ──▶ memory base ──▶ AI reads each call ──▶ weekly compile ──▶ report
   (webhook)      (Supabase)      objections · fears        (clusters +      (read it,
                                  pains · questions          counts across    print to PDF,
                                  · who they are             all calls)       feed to content)
```

- **Hands-off.** Point Fathom at it once; reports appear weekly.
- **Ranked by frequency.** Themes are clustered across calls and counted, so you
  see the *most common* objection/fear/pain/question - not a pile of one-offs.
- **In their words.** Every theme carries real verbatim quotes + a content angle.
- **The real avatar.** The single most common ideal-client profile, in detail,
  plus any secondary profiles.
- **Built for content.** A language bank of their exact phrases and a set of
  content ideas with hooks, every week.
- **Read it or print it.** Each report is a clean web page you can print to PDF,
  plus a Markdown copy you can paste anywhere.

---

## Set it up - two ways

### Option A - Guided (let Claude do it with you) 🪄

Open this repo in **[Claude Code](https://claude.ai/code)** (New session → pick
your `voice-of-customer` repo) and paste:

> **Read `SETUP.md` and set up Voice of Customer for me, one step at a time. Do
> every technical part you can (run the SQL, wire the endpoints); for anything
> that needs a click - Vercel, Fathom - give me exact instructions and wait.
> Generate any secrets for me. Ask me for each key only when you need it. Start
> now.**

It walks you through the whole thing and does the technical parts for you.

### Option B - Manual (follow the steps)

Do the numbered steps under **[Manual setup](#manual-setup)** below.

---

## How it works

| Part | File | What it does |
|------|------|--------------|
| **Collect** | `src/app/api/webhook/fathom/route.ts` | Receives each Fathom call, stores it (transcript + metadata) in the memory base, dedups re-deliveries. |
| **Understand** | `src/lib/analyze.ts` | Reads one call → objections, fears, pain points, questions, buying signals, the avatar, quotes, and their exact language → `call_insights`. |
| **Compile** | `src/lib/compile.ts` + `src/app/api/cron/weekly` | Weekly: clusters + counts across all calls, derives the most common ICP, writes the report (JSON + Markdown). |
| **Read** | `src/app/reports/[id]` | A clean, printable report page (Print → Save as PDF), plus Copy-Markdown. |

Data lives in four Supabase tables (`calls`, `call_insights`, `reports`,
`events`) - see `db/schema.sql`.

---

## Prerequisites

- **[Vercel](https://vercel.com)** - hosts it. (Pro recommended so the weekly
  cron and long report generation aren't capped; Hobby works with a couple of
  tweaks - see Step 5.)
- **[Supabase](https://supabase.com)** - the memory base.
- **[Anthropic](https://console.anthropic.com)** - a Claude API key (this is the
  brain that reads the calls and writes the report).
- **[Fathom](https://fathom.video)** - with a webhook that can POST your call
  data (including the transcript) to a URL. *(Team/Pro tiers, or route it through
  an automation.)*
- **Telegram** *(optional)* - a ping with the link when each report is ready.

---

<a name="manual-setup"></a>
## Manual setup

*(This is Option B - the same thing the guided prompt above does with you.)*

### 1. Deploy to Vercel

Import this repo into Vercel (Add New… → Project → Import). Framework auto-detects
**Next.js**. Deploy. Copy the production URL (e.g.
`https://voice-of-customer-xxxx.vercel.app`) - call it `APP_URL`.

### 2. Create the database

Supabase → **New project**. Then **SQL Editor** → paste the entire contents of
[`db/schema.sql`](db/schema.sql) → **Run**.

### 3. Environment variables

In Vercel → **Settings → Environment Variables** (see [`.env.example`](.env.example)):

| Variable | Required | What it is |
|----------|:---:|------------|
| `SUPABASE_URL` | ✅ | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Settings → API → **service_role** key (server-only) |
| `ANTHROPIC_API_KEY` | ✅ | Your Claude API key |
| `FATHOM_WEBHOOK_SECRET` | ✅ | Any long random string - verifies the Fathom webhook |
| `CRON_SECRET` | ✅ | Any long random string - gates the crons + manual endpoints |
| `VOC_BUSINESS_CONTEXT` | recommended | A paragraph on your offer + who you sell to (sharpens the analysis) |
| `VOC_ANALYSIS_MODEL` / `VOC_REPORT_MODEL` | optional | Default `claude-opus-5`; set a cheaper model for very high call volume |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | optional | Report-ready pings |
| `VOC_PUBLIC_URL` | optional | Your `APP_URL`, used to build report links in pings |

Redeploy so they take effect. Open `APP_URL` - the dashboard shows what's wired.

### 4. Connect Fathom

Set up your Fathom webhook (Fathom → Settings → Integrations/Webhooks, or an
automation that fires on a new recording) to **POST** the call - **including the
transcript** - to:

```
APP_URL/api/webhook/fathom?secret=YOUR_FATHOM_WEBHOOK_SECRET
```

(You can send the secret as an `x-webhook-secret` header instead of the query.)
The parser is tolerant of Fathom's field names; the one thing that matters is
that the transcript is in the payload.

**Test without waiting for a call** - backfill any transcript:

```bash
curl -X POST "APP_URL/api/ingest?key=YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test call","call_date":"2026-01-15","transcript":"PROSPECT: I really want more clients but I have no time... REP: ..."}'
```

Then check the dashboard - the call should show as analyzed within a few seconds.

### 5. Schedule it

`vercel.json` declares a weekly compile (Mondays 08:00 UTC) and an hourly analyze
sweep.

- **Vercel Pro:** nothing to do.
- **Vercel Hobby** (cron capped at once/day, functions at 60s): analysis runs on
  intake so you mostly don't need the sweep; for the weekly report, either
  upgrade to Pro, or trigger `APP_URL/api/cron/weekly` from an external scheduler
  (e.g. Supabase pg_cron or cron-job.org) with header
  `Authorization: Bearer YOUR_CRON_SECRET`. If a big report ever times out on
  Hobby, set `VOC_REPORT_MODEL=claude-sonnet-5`.

### 6. Read your first report

Wait for the weekly run, or generate one now:

```
APP_URL/api/compile?key=YOUR_CRON_SECRET&days=30
```

Then open it from the dashboard (or `APP_URL/reports`). Hit **Print / Save as
PDF**, or **Copy Markdown** to paste into a doc or content brief.

---

## What's in each report

- **Top objections / fears / pain points** - clustered and ranked by how many
  calls they showed up in, each with what it really means, verbatim quotes, and a
  content angle.
- **Most-asked questions** - ranked, with example phrasings.
- **Ideal client profile** - the most common avatar in detail: role, industry,
  stage, goals, pains, fears, triggers, emotional drivers, the objections they
  carry, awareness level, budget reality, demographics, and *how they talk*.
- **Language bank** - their exact phrases, ready to drop into hooks and copy.
- **Content ideas** - 5-8 for the week, each tied to a real objection/pain/
  question, with a hook in the prospect's own voice.
- **Standout quotes.**

---

## Tuning the analysis

- **`VOC_BUSINESS_CONTEXT`** is the biggest lever - a short paragraph on your
  offer and audience makes every extraction sharper. Set it and redeploy.
- **Models** default to `claude-opus-5` (best read). For very high volume, set
  `VOC_ANALYSIS_MODEL=claude-sonnet-5` to cut cost; the report model can stay on
  Opus since it runs once a week.

---

## Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/webhook/fathom` | `?secret=` / `x-webhook-secret` | Fathom intake |
| `POST /api/ingest` | `?key=` / Bearer `CRON_SECRET` | Manual transcript ingest / backfill |
| `GET /api/cron/analyze` | Bearer `CRON_SECRET` | Analyze sweep (retries) |
| `GET /api/cron/weekly` | Bearer `CRON_SECRET` | Weekly compile |
| `GET /api/compile` | `?key=` / Bearer `CRON_SECRET` | Compile on demand (`?days=` or `?start=&end=`) |

---

## Troubleshooting

- **Calls arrive but never analyze.** They probably came in without a transcript
  - configure the Fathom webhook to include it. Check `calls.status` (`skipped` =
  no transcript) and the `events` table.
- **Weekly report is empty.** It only counts calls with `status = analyzed` in
  the window. Confirm calls are analyzing first.
- **Report generation times out (Hobby).** Upgrade to Vercel Pro or set
  `VOC_REPORT_MODEL=claude-sonnet-5`.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm run typecheck            # tsc --noEmit
```

## License

MIT - see [LICENSE](LICENSE).
