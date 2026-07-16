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

Open risks: Vercel-side behavior (includeFiles bundling of `tenants/`, function
maxDuration) is untested until the next deploy; prod Vercel env still needs
OPENAI_API_KEY / SUPABASE_* / RESEND_API_KEY / TENANT_ID set before pushing.
