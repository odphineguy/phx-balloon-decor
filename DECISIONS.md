# Decisions

Newest on top. Settled questions — don't relitigate without new information.

## 2026-07-16 — Balloon SaaS v1 (tenant config, gpt-image-2, lead gate)

Implemented `BALLOON_SAAS_SPEC.md` end-to-end. Divergences from spec, all reality-driven:

- **`input_fidelity: "high"` is NOT sent to gpt-image-2.** The spec asked for
  "gpt-image-2 with input_fidelity: high", but the OpenAI API rejects the param on
  gpt-image-2 — that model processes input images at high fidelity natively (the param
  exists only for gpt-image-1/1.5). Confirmed by current OpenAI docs and the Waterloo
  reference pipeline (`supportsInputFidelity` branch, mirrored here in
  `lib/generate-core.js`). The spec's intent (high-fidelity venue edits) is fully met;
  the spec's gpt-image-1.5 fallback was NOT needed — gpt-image-2 accepts the edit call
  shape and produced a verified correct render (framing preserved, 1024x1024 for a
  square source). Setting `OPENAI_IMAGE_MODEL=gpt-image-1.5` re-enables the param
  automatically.
- **The original root-`.env` OpenAI key was genuinely invalid** (malformed
  `skproj_…` value, 401 from the API). Abe swapped in a fresh `sk-proj-…` key
  mid-build (2026-07-16 15:50) and live renders succeeded immediately after.
- **Spec's `#services` nav anchor was already dead** — index.html has never had a
  `#services` section (nav link predates this work). Left as-is; out of scope.
- **Logo path is `images/phxballdecor.png`**, not the spec's guessed
  `phoenix-balloon-decor.svg`. Tenant config points at the real file.
- **`tenants/_template.json` uses `_`-prefixed doc keys** (JSON has no comments);
  `lib/tenant.js` ignores them.
- **notifyEmail = odphineguy@gmail.com** for tenant #1 (owner's address, same pattern
  as Waterloo). The footer's public email stays hello@phoenixballoons.com.
- **Extra shared module `lib/leads-core.js`** beyond the spec's two named lib files —
  same keep-backends-identical rationale the spec used for generate-core.
- **Rate limit on /api/leads:** naive in-memory 10/min per IP, copied from the
  Waterloo pattern. Per-instance on serverless; fine at this scale.
- **Reveal-before-POST:** the lead form reveals the render first, then fires
  `/api/leads` (spec hard constraint: ad blockers must never eat the demo moment).
  Verified in-browser with a fetch override rejecting the leads call — reveal still
  worked, quote shown.

Verification (2026-07-16, all passing): `/api/config` serves zero prompt text;
live gpt-image-2 render via dev server (gold/white Classic Garland on the entrance
photo); migration applied to Supabase `qcgqmomauwpulvotxmls` (additive only, existing
March-Madness tables untouched); one test lead POST → row landed in `balloon_leads` +
Resend email delivered to odphineguy@gmail.com → test row deleted (table back to 0);
dummy second tenant (`test-vendor`) rebranded the whole site — purple theme, new
title/kicker/styles/prices — with zero code edits, then deleted; no Gemini references
remain outside `ai-stuff/`.

Security note: `server/.env.example` had a real-looking Gemini API key committed in
git history — replaced with a placeholder; the key should be revoked in Google AI
Studio. Gemini is no longer used anywhere.

## 2026-07-16 — Production deploy + the 60-second render kill (RESOLVED)

Deployed to Vercel (23e9350 … 9778266). Verified live: homepage, /api/health,
/api/config (tenant bundling via includeFiles works, zero prompt text),
/api/prices, /api/leads validation, and complete gpt-image-2 renders.

**Symptom:** renders longer than ~60s had their connection severed at ~60.5s
with no HTTP status. gpt-image-2 at quality "medium" takes 56–115s.

**Root cause:** connections carrying ZERO bytes for ~60s get severed by
network intermediaries. Both legs were affected when testing from Abe's
Mac: curl→Vercel (idle while the function rendered) AND, in dev,
node→api.openai.com (the OpenAI SDK's silent retries masked this — a "114s
dev success" was really a 60s idle kill + a 54s successful retry; a later
dev run burned 3 × 60s attempts and failed with UND_ERR_SOCKET "other side
closed"). An earlier entry here wrongly cleared the local network based on
that masked success. Vercel's config was never the problem — maxDuration 300,
fluid, and the dashboard default were all correct.

**Fix (9778266): heartbeat streaming — `lib/heartbeat.js`.** /api/generate
validates fast with real status codes, then commits to a streamed 200 that
writes a whitespace byte every 5s until the JSON payload is ready (leading
whitespace is valid JSON; the frontend's response.json() is unaffected).
Post-validation failures arrive as 200 + {success:false,error}, which the
frontend already branches on. This is also Vercel's documented recommendation
for long no-byte responses. Verified: prod render HTTP 200 in 83.6s.

Residual (local dev only): renders from this Mac's network can still lose the
node→OpenAI leg at ~60s and silently retry (SDK maxRetries=2), so dev renders
sometimes take ~2× longer. Datacenter-side (Vercel→OpenAI) is unaffected.

Prod env vars were set by Abe (renders, Supabase, config all confirmed live).
