# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing site for Phoenix Balloon Decor with an embedded AI tool that takes a
photo of a venue and renders balloon decorations into it via Google Gemini, returning a styled
image plus an estimated price quote. The production site is a static `index.html` served by
Vercel, with image generation handled by a Vercel serverless function.

## Commands

There is no build step or test suite for the production site — `index.html` loads Tailwind, GSAP,
and the visualizer script directly from CDNs / a relative path.

Local development (runs the Express dev server which also serves the static site):

```bash
cd server
npm install
npm run dev      # node --watch index.js, serves site + API on http://localhost:3001
npm start        # same without file watching
```

`GEMINI_API_KEY` must be set in `server/.env` (dev) or the Vercel project env (prod). Copy from
`.env.example`.

Deployment is Vercel (`vercel.json`); `api/generate.js` is configured with `maxDuration: 60`.

## Architecture

**Two interchangeable backends with identical logic** — keep them in sync when changing
generation behavior:
- `api/` — Vercel serverless functions for production (`generate.js`, `prices.js`, `health.js`).
  `generate.js` parses multipart uploads with **formidable** and disables Vercel's body parser.
- `server/index.js` — Express dev server (port 3001) that parses uploads with **multer** and also
  serves the static site from the repo root (`express.static('..')`). Exposes the same
  `/api/generate`, `/api/prices`, `/api/health` routes.

Both call Gemini model `gemini-2.0-flash-exp` with `responseModalities: ['TEXT', 'IMAGE']`, then
walk `response.candidates[0].content.parts` to pull out the inline base64 image and any text.

**Frontend** — `js/balloon-visualizer.js` is a vanilla-JS IIFE module (no framework, no bundler).
It builds the entire visualizer UI into the `#ai-visualizer-app` div inside `index.html`, manages
upload/color/style state, builds the Gemini prompt, and POSTs a `FormData` to `/api/generate`. It
picks the API base by hostname: `http://localhost:3001` on localhost, same-origin otherwise
(`balloon-visualizer.js:8`).

**Data that is duplicated across files** (update all copies together):
- `STYLE_PRICES` — defined in `api/generate.js`, `api/prices.js`, and `server/index.js`.
- `BALLOON_STYLES` (the per-style Gemini prompt templates with the `{colors}` placeholder) and
  `BALLOON_COLORS` — defined only in `js/balloon-visualizer.js`. The frontend fetches prices from
  `/api/prices` at load and merges them into `BALLOON_STYLES`, so prices have a server source of
  truth but style prompts/IDs live in the frontend and must match the `STYLE_PRICES` keys.

**`ai-stuff/`** — a separate, standalone React + TypeScript prototype (Vite-style, uses an ES
module import map and `@google/genai`, calling Gemini directly from the browser). It is **not**
wired into the production `index.html` and does not share the `api/`/`server/` backends. Treat it
as a reference/prototype unless explicitly working on it.

## Conventions

- Brand theme is defined as CSS variables in `index.html`: `--teal #1A5E63`, `--gold #B8860B`,
  `--off-white #F9F9F9`, `--dark #333333`, with matching Tailwind utility classes
  (`bg-teal`, `text-gold`, etc.). Fonts: Playfair Display (headings) + Montserrat (body).
- Uploads are validated to JPEG/PNG/WebP, max 10MB, in both the frontend and both backends.
- Color selection is capped at 3.
