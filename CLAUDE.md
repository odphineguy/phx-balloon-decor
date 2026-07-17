# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tenant #1 of a multi-tenant SaaS for balloon decor vendors. A single-page marketing site with an
embedded AI tool: a visitor uploads a venue photo, picks colors + a style, and OpenAI renders
balloon decorations into the photo. The render is shown blurred behind a lead-capture form
(name/email/phone/event date); submitting reveals it with a price estimate. Leads persist to
Supabase and notify the vendor via Resend. The production site is a static `index.html` served by
Vercel with serverless functions in `api/`.

`BALLOON_SAAS_SPEC.md` is the implemented v1 spec; `DECISIONS.md` records the reality-vs-spec
divergences (read it before relitigating anything).

## Commands

There is no build step or test suite — `index.html` loads Tailwind, GSAP, and the visualizer
script from CDNs / relative paths. Syntax gate: `node --check <file>`.

Local development (Express dev server, also serves the static site):

```bash
npm install          # repo root — deps for api/ + lib/ (openai, resend, supabase-js, formidable)
cd server && npm install
npm run dev          # node --watch index.js, serves site + API on http://localhost:3001
```

Env lives in the **root `.env`** (see `.env.example`): `TENANT_ID`, `OPENAI_API_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, optional `OPENAI_IMAGE_MODEL`.
The dev server loads root `.env` first, then `server/.env` (PORT only). In prod these go in the
Vercel project env. Deployment is Vercel; pushing to `origin/main` auto-deploys.

## Architecture

**Shared logic in `lib/`, two thin backends.** Both backends import the same modules — change
behavior in `lib/`, not in the endpoint wrappers:
- `lib/tenant.js` — loads `tenants/<TENANT_ID>.json` (cached), exposes `publicConfig()` (the
  browser-safe subset — **strips style prompts and notifyEmail**), `findStyle`, `stylePrices`.
- `lib/generate-core.js` — validates styleId/colors against the tenant, interpolates `{colors}`
  into the style prompt **server-side**, calls OpenAI `images.edit` (model `gpt-image-2` by
  default via `OPENAI_IMAGE_MODEL`), picks the output size closest to the uploaded photo's aspect
  ratio. `input_fidelity: "high"` is sent ONLY for models that accept it (gpt-image-1/1.5);
  gpt-image-2 is natively high-fidelity and rejects the param.
- `lib/leads-core.js` — lead validation, Supabase insert (service role) + Resend notification to
  the tenant's `contact.notifyEmail`, run independently so one failing never blocks the other.
  Sends from `studio@abemedia.online` (verified Resend domain).

- `lib/heartbeat.js` — renders take 56–115s with no response bytes, and idle connections get
  severed at ~60s by network intermediaries. `/api/generate` therefore validates fast (real
  status codes), then commits to a **streamed 200** that writes a whitespace byte every 5s until
  the JSON is ready. Post-validation failures are `200 + {success:false,error}`. Keep this
  pattern for any future slow endpoint.

Backends:
- `api/` — Vercel functions (`config.js`, `prices.js`, `generate.js`, `leads.js`, `health.js`).
  `generate.js` parses multipart with **formidable** (body parser disabled). `vercel.json` sets
  `maxDuration` and `includeFiles: tenants/**` so tenant JSON ships in each function bundle.
- `server/index.js` — Express dev server (port 3001, **multer**, serves the repo root statically)
  exposing the same five routes.

**Tenant config (`tenants/`)** — one JSON per vendor holds ALL branding, theme, fonts, contact,
ui copy, lead-gate settings, colors, styles, prices, and prompts. `TENANT_ID` env selects it.
Onboarding a vendor = copy `tenants/_template.json`, fill it, set `TENANT_ID`. Zero code changes.
**Style prompts are the product: they must never reach the browser.** Only `publicConfig()`
output is served to clients.

**Frontend** — `js/balloon-visualizer.js`, a vanilla-JS IIFE (no framework, no bundler — keep it
that way). At load it fetches `/api/config`, applies tenant branding to the whole page (CSS vars
`--teal`/`--gold`/`--off-white`/`--dark`/`--heading-font`/`--body-font`, plus elements marked
`data-tenant="logo|business-name|contact-email|visualizer-kicker"` in `index.html`), and builds
the visualizer UI into `#ai-visualizer-app`. Generation POSTs FormData (image, styleId, colors,
width, height) — no prompt text. The lead gate reveals on submit REGARDLESS of the `/api/leads`
outcome (ad blockers must not kill the demo moment); the POST happens after the reveal.
API base is `http://localhost:3001` on localhost, same-origin otherwise.

**Supabase** — project `qcgqmomauwpulvotxmls` ("March-Madness Project", shared with unrelated
tables — do not touch `users`/`brackets`/`tournament_results`). `balloon_leads` table per
`supabase/migrations/20260716000000_balloon_leads.sql` (applied 2026-07-16): RLS enabled with NO
policies — service role only, no anon access.

**`ai-stuff/`** — a dead standalone React/TS prototype. Not wired in. Do not touch.

## Conventions

- Page structure: hero → AI visualizer section (`#ai-preview`) → about → portfolio → contact.
  The hero CTA "See It In Your Space" anchors to `#ai-preview`.
- Uploads validated to JPEG/PNG/WebP, max 10MB, in the frontend and both backends
  (constants exported from `lib/generate-core.js`). Color selection capped at 3.
- Default theme: `--teal #1A5E63`, `--gold #B8860B`, `--off-white #F9F9F9`, `--dark #333333`;
  Playfair Display headings + Montserrat body — but all of it is tenant-config-driven at runtime.

## Gotchas

- The static before/after compare slider (`#visualizer`) reveals its overlay via
  `clip-path: inset(...)`, not by resizing the overlay div — resizing breaks `object-fit: cover`
  alignment. Container uses `aspect-ratio: 1/1` + inline `height:auto`.
- GSAP pulses every `.btn-primary` (scale 1.05 loop), which makes Playwright-style coordinate
  clicks on those buttons flaky. Dispatch clicks via JS in browser automation.
- The dev machine's network severs idle TLS connections at ~60s. Consequences: dev-server
  renders can lose the node→OpenAI leg and silently retry (the OpenAI SDK's maxRetries=2 makes
  them take ~2× longer), and any long no-byte HTTP response tested from this machine dies at
  ~60s — that's the client-side network, not the server. See DECISIONS.md 2026-07-16.
