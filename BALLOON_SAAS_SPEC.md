# Balloon Decor SaaS — Multi-Tenant Platform Spec (v1)

## Overview

Transform this single-client marketing site into the flagship tenant of a multi-tenant
SaaS platform for balloon decor vendors ("Waterloo playbook"). One config file per
vendor, zero code changes per tenant. In the same pass:

1. **Model swap:** Gemini `gemini-2.0-flash-exp` → OpenAI `gpt-image-2` with
   `input_fidelity: "high"` (same call pattern as the Waterloo Design Studio render
   pipeline, which uses gpt-image-1.5 — verify the gpt-image-2 param names against
   current OpenAI docs; fall back to gpt-image-1.5 only if gpt-image-2 rejects the
   image-edit call shape, and report it).
2. **Lead capture gate:** visitor must submit name/email/phone/event-date BEFORE the
   generated render is revealed. Leads persist to Supabase and email via Resend.
3. **Tenant config architecture:** all branding, styles, prompts, colors, and prices
   move out of code into a per-tenant config. Phoenix Balloon Decor is tenant #1.
4. **Page reorder:** AI Visualization section moves to directly below the hero;
   hero primary CTA ("See It In Your Space") scrolls to it.

## Context — read before starting

Read: `CLAUDE.md`, `index.html`, `js/balloon-visualizer.js`, `api/generate.js`,
`api/prices.js`, `server/index.js`.

Key facts:
- Production = static `index.html` on Vercel + serverless functions in `api/`.
  Dev = Express server in `server/index.js` (port 3001) serving the static root.
  The two backends duplicate logic — keep them in sync or (preferred) extract shared
  modules both import.
- Frontend is a vanilla-JS IIFE (`js/balloon-visualizer.js`), no bundler. Keep it
  that way for v1 — do NOT introduce React/Vite here.
- `STYLE_PRICES` is currently duplicated in `api/generate.js`, `api/prices.js`, and
  `server/index.js`. `BALLOON_STYLES` prompts + `BALLOON_COLORS` live only in
  `js/balloon-visualizer.js`. ALL of this moves to tenant config (single source of truth).
- `ai-stuff/` is a dead standalone prototype. Do not touch it, do not wire it in.
- Brand theme is CSS variables in `index.html` (`--teal`, `--gold`, etc.) — these become
  tenant-config-driven.
- Reference implementation for the render + lead-gate pattern:
  `/Volumes/Media 2TB/waterloo_ai_demo` (gpt-image-1.5 call shape, input_fidelity,
  Supabase lead insert, Resend notification). Mirror the patterns, adapt to vanilla JS.

## 1. Tenant Config Architecture

Create `tenants/` directory at repo root:

- `tenants/phoenix-balloon-decor.json` — tenant #1, populated from current hardcoded
  values (styles, prompts, colors, prices, brand CSS vars, logo path, business name,
  contact email/phone, notification email).
- `tenants/_template.json` — fully commented template for onboarding a new vendor.

Config schema (per tenant):
```
{
  "id": "phoenix-balloon-decor",
  "businessName": "Phoenix Balloon Decor",
  "logo": "/images/phoenix-balloon-decor.svg",
  "theme": { "primary": "#1A5E63", "accent": "#B8860B", "bg": "#F9F9F9", "text": "#333333",
             "headingFont": "Playfair Display", "bodyFont": "Montserrat" },
  "contact": { "phone": "", "email": "", "notifyEmail": "" },
  "colors": [ { "name": "Pastel Pink", "hex": "#FFD1DC" }, ... ],
  "styles": [ { "id": "classic-garland", "name": "...", "description": "...",
                "price": 250, "prompt": "..." }, ... ],
  "leadGate": { "enabled": true, "fields": ["name", "email", "phone", "eventDate"] }
}
```

Tenant resolution (v1): environment variable `TENANT_ID` (default
`phoenix-balloon-decor`) selects the config server-side. Frontend fetches
`/api/config` at load, which returns the public subset of the tenant config
(NO prompts — prompts stay server-side, see Constraints). Frontend renders styles,
colors, prices, theme vars, and branding from that response. Do not ship prompt
templates to the browser anymore.

Future (do NOT build now, just don't block it): subdomain → tenant mapping.

## 2. Model Swap: Gemini → gpt-image-2

- Remove `@google/generative-ai`; add `openai`.
- New env var: `OPENAI_API_KEY` (update both `.env.example` files; remove GEMINI key refs).
- `api/generate.js` + `server/index.js`: replace Gemini call with OpenAI images edit
  endpoint, model `gpt-image-2`, `input_fidelity: "high"`, passing the uploaded venue
  photo as the input image and the tenant style prompt (with `{colors}` interpolated
  server-side from the submitted color selection).
- Prompt assembly moves fully server-side: frontend sends `styleId` + `colors` only.
  Server looks up the prompt from tenant config. Reject unknown styleIds.
- Keep upload validation (JPEG/PNG/WebP, 10MB) and CORS behavior as-is.
- Response shape to frontend stays compatible: `{ success, image, price, colors }`
  (drop `text` if the model returns none).
- Keep `maxDuration: 60` in `vercel.json`.

## 3. Lead Capture Gate (Waterloo pattern)

Flow change in `js/balloon-visualizer.js`:
1. User uploads photo, picks colors + style, clicks Generate.
2. Generation starts immediately (don't make them wait twice) BUT the result is
   shown blurred/locked with an overlay form: name, email, phone, event date,
   "Reveal My Design" button.
3. On form submit → POST `/api/leads` → unblur the render, show price estimate and
   "Book Now" CTA (links to tenant contact / booking anchor).
4. If lead insert fails, still reveal (never lose the demo moment) but log the error.

### `/api/leads` (new: `api/leads.js` + Express route)
- Body: `{ tenantId, name, email, phone, eventDate, styleId, colors, renderIncluded }`
- Insert into Supabase `balloon_leads` table.
- Send notification email via Resend to tenant `contact.notifyEmail`:
  subject "New AI Visualizer Lead — {name}", body with all lead fields + style/price.
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
- Send from `studio@abemedia.online` (verified Resend domain — same sender as Waterloo).

### Supabase
- **Target project: "March-Madness Project", ref `qcgqmomauwpulvotxmls`**
  (https://qcgqmomauwpulvotxmls.supabase.co). Existing project, currently no
  migrations applied — do not touch any existing tables/data in it.
- Write the migration: `supabase/migrations/<timestamp>_balloon_leads.sql`
- Table `balloon_leads`: id uuid pk, tenant_id text, name text, email text, phone text,
  event_date date null, style_id text, colors jsonb, created_at timestamptz default now().
- RLS: no anon read. Inserts only via service role from the API (service key never
  ships to the browser).

## 4. Page Reorder + Hero CTA

In `index.html`:
- Move the AI Visualization section (`#ai-visualizer-app` and its wrapper) to be the
  FIRST section after the hero. Services/About shift down. Keep nav anchors working.
- Hero primary button "See It In Your Space" → smooth-scroll to the AI section.
- Add a short kicker above the tool: "Try it free — see your venue decorated in
  60 seconds." (tenant-configurable string, key `ui.visualizerKicker`).
- Preserve existing GSAP animations; re-trigger scroll animations after reorder.

## 5. Constraints

- **Prompts are the product.** Style prompt templates must never be sent to the
  browser. Server-side interpolation only.
- **No framework migration.** Vanilla JS IIFE + static HTML stays for v1.
- **Do not touch `ai-stuff/`.**
- **Keep dev/prod backends behaviorally identical** — extract shared logic into
  importable modules (e.g., `lib/tenant.js`, `lib/generate-core.js`) used by both.
- **Verify against reality (Reality Principle):** if the live repo/DB disagrees with
  this spec's assumptions (file paths, duplicated constants, env), the repo/DB wins —
  note the discrepancy in the final report and adapt.
- **No pricing/margin logic beyond the per-style display price.** No payment
  processing in v1.
- Lead reveal must not be blockable by ad blockers killing the Supabase call —
  reveal on submit regardless of insert outcome.
- npm here (this repo is npm, not pnpm).

## 6. Files

**New:** `tenants/phoenix-balloon-decor.json`, `tenants/_template.json`,
`api/config.js`, `api/leads.js`, `lib/tenant.js`, `lib/generate-core.js`,
`supabase/migrations/<ts>_balloon_leads.sql`

**Modify:** `index.html` (section reorder, hero CTA, theme vars from config),
`js/balloon-visualizer.js` (config fetch, lead gate, no client-side prompts),
`api/generate.js`, `api/prices.js` (now reads tenant config), `server/index.js`,
`package.json` (drop @google/generative-ai, add openai, resend,
@supabase/supabase-js), both `.env.example` files, `vercel.json` if needed,
`CLAUDE.md` (update architecture notes).

**Do not modify:** `ai-stuff/**`, `images/**`.

## 7. Acceptance Criteria

- [ ] `/api/config` returns tenant branding/styles/colors/prices — no prompt text
- [ ] Render pipeline uses gpt-image-2 with input_fidelity high; Gemini fully removed
- [ ] Generate → blurred result → lead form → reveal + price works end-to-end locally
- [ ] Lead row lands in `balloon_leads`; Resend notification arrives at notifyEmail
- [ ] AI Visualization is the first section under the hero; hero CTA scrolls to it
- [ ] Adding `tenants/new-vendor.json` + `TENANT_ID` env change rebrands the entire
      site with zero code edits (test with a dummy second tenant, then delete it)
- [ ] Dev server (`server/index.js`) and Vercel functions behave identically
- [ ] No secrets or prompts in any browser-delivered file
