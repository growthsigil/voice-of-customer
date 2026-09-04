# SETUP — guided walkthrough

**You (Claude) are setting up "Voice of Customer" for the user. Work through this
ONE STEP AT A TIME. Confirm each step before moving on.**

House rules:
- **Ask for one thing at a time.** Need a key? Ask for just that one, wait, continue.
- **Do every technical part you can.** If you have a Supabase connector, run the
  SQL yourself; otherwise hand over the exact SQL to paste and wait for "done".
  You can `curl` the app's own endpoints to test — do that rather than making the
  user do it.
- **Generate the secrets** (long random strings) and show them; don't make the
  user invent them.
- **Hand off click-only steps** (Vercel import, Fathom webhook) with precise,
  numbered instructions and wait.
- **Keep it human** — short messages, plain language.

Checklist:
- [ ] 1. Vercel deploy (get the app URL)
- [ ] 2. Supabase project + run the schema
- [ ] 3. Environment variables
- [ ] 4. Business context (sharpens the analysis)
- [ ] 5. Connect Fathom
- [ ] 6. Test with a sample transcript
- [ ] 7. Schedule the weekly report
- [ ] 8. Generate the first report

---

## Step 1 — Deploy to Vercel

1. **vercel.com → Add New… → Project → Import** this `voice-of-customer` repo
   (connect GitHub if needed).
2. Framework auto-detects **Next.js** — leave defaults. **Deploy** (it's fine if
   it runs without env vars for now).
3. Copy the **production URL**. Remember it as `APP_URL`. **Ask the user for it.**

## Step 2 — Supabase

1. **supabase.com → New project** (name it, pick a region, set a DB password).
   Wait ~2 min.
2. **Settings → API** → get the **Project URL** (`SUPABASE_URL`) and the
   **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`). ⚠️ Tell them the
   service_role key is powerful and server-only. **Ask for both.**
3. Create the tables from `db/schema.sql`: run it via your Supabase tool, or have
   them paste the whole file into **SQL Editor → Run**. Confirm the tables
   `calls`, `call_insights`, `reports`, `events` exist.

## Step 3 — Environment variables

Set these in Vercel → **Settings → Environment Variables**. Generate the secrets
yourself.

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | from Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 2 |
| `ANTHROPIC_API_KEY` | **ask** — their key from console.anthropic.com |
| `FATHOM_WEBHOOK_SECRET` | **generate** a long random string |
| `CRON_SECRET` | **generate** a long random string |

Optional (offer them): `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (report pings),
`VOC_PUBLIC_URL` (= `APP_URL`, for links in pings). Then **redeploy**.

## Step 4 — Business context

Ask the user for a short paragraph: **what they sell, who they sell to, and what a
sales call is for.** Set it as `VOC_BUSINESS_CONTEXT` in Vercel and redeploy. This
noticeably sharpens the analysis. (If they don't have one handy, help them write
2–3 sentences, or skip and add later.)

## Step 5 — Connect Fathom

Tell them: in **Fathom → Settings → Integrations / Webhooks** (or an automation
that fires on a new recording), create a webhook that **POSTs the call, including
the transcript**, to:

```
APP_URL/api/webhook/fathom?secret=<FATHOM_WEBHOOK_SECRET>
```

The important part is that the transcript is included in what Fathom sends. If
their plan can't include the transcript in the webhook, note it and continue —
they can still ingest transcripts manually (Step 6) and revisit.

## Step 6 — Test with a sample transcript

Before waiting for a real call, prove the pipeline works. `curl` the ingest
endpoint yourself with a short fake transcript:

```bash
curl -X POST "APP_URL/api/ingest?key=<CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test call","transcript":"PROSPECT: I keep trying to grow but I have zero time, and honestly I got burned by an agency last year so I am nervous about spending again. How long until I would see results? REP: Totally fair..."}'
```

Then check `APP_URL` (the dashboard) — "analyzed" should tick up within a few
seconds. If it errors, read the response and the `events` table and fix it.

## Step 7 — Schedule the weekly report

`vercel.json` already declares the weekly compile.
- **Vercel Pro:** nothing to do.
- **Vercel Hobby:** analysis runs on intake, so that's covered; for the weekly
  report, either tell them Pro is smoother, or set up an external scheduler
  (Supabase pg_cron / cron-job.org) hitting `APP_URL/api/cron/weekly` with header
  `Authorization: Bearer <CRON_SECRET>`. If a report ever times out on Hobby, set
  `VOC_REPORT_MODEL=claude-sonnet-5`.

## Step 8 — Generate the first report

Once a couple of calls are analyzed (the test call counts), generate a report so
they can see the output:

```
APP_URL/api/compile?key=<CRON_SECRET>&days=30
```

Open the returned URL (or the dashboard → "Read the latest report"). Show them the
**Print / Save as PDF** and **Copy Markdown** buttons.

Wrap up — remind them:
- Reports compile **weekly** automatically from here.
- Tune quality anytime via `VOC_BUSINESS_CONTEXT`.
- Everything they need for content is in the report: top objections/fears/pains/
  questions, the ideal client profile, a language bank, and content ideas.
