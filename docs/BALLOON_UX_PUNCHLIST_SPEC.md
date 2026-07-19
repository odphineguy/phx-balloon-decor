# BALLOON_UX_PUNCHLIST_SPEC.md
*Scope: phx-balloon-decor platform (multi-tenant hosted, live at phx-balloon-decor.vercel.app). Five fixes, all front-end/UX. No pricing logic, no backend contract changes. Written July 18, 2026.*

## Phase 0 — Recon (Reality Principle)
Before touching anything: locate the repo, run it locally, and reproduce all five issues. Identify the components that own (a) the two-column try-it-free layout, (b) the AI Preview panel, (c) the lead-capture overlay, (d) the loading state, (e) the quote download action, (f) the color swatch grid. Map spec items to actual component names before writing code. If the repo diverges from what this spec assumes, the repo wins — adjust and note it in DECISIONS.md.

## Item 1 — Rendered image is too small (the money shot is cramped)
**Problem:** After generation, the AI render sits in the right column at roughly half the viewport while the left column (upload + colors + styles) keeps equal width. The render is the product; it should dominate. Reference target: the Waterloo demo's large-render layout that sold Bob.

**Required behavior:**
- Pre-generation: current two-column layout stays as-is (form needs the space).
- Post-generation: layout shifts to a "reveal" state where the render becomes the hero — full container width (or near it), with the input controls (upload thumbnail, colors, style list) collapsing to a compact strip: either a slim left rail, a collapsed accordion above, or moved below the render. Builder chooses the cleanest fit for the existing component structure; the acceptance bar is "render occupies the clear majority of the viewport on desktop."
- The result card (style name, colors, price, Book Now, Download buttons) stays attached directly beneath or beside the render — do not orphan the CTA from the image.
- "Generate again / change options" affordance must remain one click away (expanding the collapsed strip).
- Mobile: render full-width; controls collapse into an accordion below.

## Item 2 — Lead-capture form looks trapped inside the image container
**Problem:** The "Your design is ready!" gate renders as a white card jammed inside the blurred-preview container, with blurred image strips visible on both sides. Looks broken rather than designed.

**Required behavior — pick ONE of these two treatments and implement it fully:**
- **Option A (modal):** capture form opens as a proper centered modal overlay above the full blurred render (blur covering the ENTIRE preview area edge-to-edge, no strips), dimmed backdrop, rounded card, subtle shadow. Blurred render visible around all edges of the modal sells "your design is right behind this."
- **Option B (integrated panel):** the preview area itself becomes the form — full-bleed blurred render as the background of the whole panel with a gradient scrim, form fields laid over it, no visible card boundary fighting the container.
- Either way: no partial blur strips, no card-inside-card seams. The form must read as intentional.
- Keep fields exactly as-is (name, email, phone, event date optional, Reveal My Design). No new fields — this is styling only. Do not weaken the gate: image stays hidden until submit.

## Item 3 — Loading state: "Getting the party started..." spinner
**Problem:** Generic gray spinner for a ~60-second balloon-decor generation. Dead air at the moment of highest anticipation.

**Required behavior:**
- Replace the plain spinner with an on-brand animated loading experience. Direction (builder refines within these bounds): floating/drifting balloon shapes in the user's three selected colors — CSS/SVG animation, no heavy libraries, no GIFs.
- Rotating status lines that imply progress, swapping every ~6-8s: e.g. "Inflating the balloons…", "Matching your colors…", "Styling your <style name>…", "Adding the finishing touches…". Use the user's actual selections (colors, style) in the copy where available.
- A determinate-feeling progress bar is welcome (eased fake progress capped at ~90% until the render actually returns) — never a bar that stalls at 100%.
- Must not shift layout when the render arrives; the loader occupies the same container the image will fill.
- Respect prefers-reduced-motion: fall back to a gentle fade/pulse.

## Item 4 — Mobile "Download Quote" broken (existing punch-list item)
**Problem:** Download Quote fails on mobile.
- Phase 0 must reproduce on a real phone or accurate emulation and capture the actual error (console/network) before fixing. Diagnose, don't guess: common culprits are blob-URL downloads or the download attribute being unsupported/blocked in iOS Safari and in-app browsers.
- Fix must work in iOS Safari at minimum; verify Android Chrome. Acceptable patterns: open PDF in new tab with share-sheet friendly response headers, or navigate directly to a server URL serving Content-Disposition: attachment. Whatever ships must be verified on-device, not just in devtools emulation.

## Item 5 — Swatch checkmark contrast on light colors (existing punch-list item)
**Problem:** The selected-state checkmark is light/white-ish; on pale swatches (pastel pink, light blue, cream, pale yellow) selection is nearly invisible.
- Compute or hardcode per-swatch contrast: dark checkmark (near-black or the swatch's darkened tone) on light swatches, white checkmark on dark swatches. A luminance threshold utility is fine; a per-color config field is also fine since the palette is fixed.
- Keep the existing ring/border selected indicator, and ensure the ring itself also has sufficient contrast against the white card background for the pale swatches.
- Acceptance: every swatch's selected state clearly visible at a glance; check all colors in the palette, not just the reported ones.

## Constraints
- No changes to pricing values, quote math, booking flow logic, or the lead-capture contract (fields, where submissions go).
- Multi-tenant: all styling changes must work for any tenant's palette/config, not just the PHX demo tenant. No hardcoded tenant colors in components — brand tones come from theme/config.
- No new heavyweight dependencies for animation (no lottie unless already present).
- Test in incognito + on a real phone before calling anything done (standing rule).

## Acceptance criteria
- [ ] Post-generation, the AI render is the dominant element on screen (desktop and mobile), with controls collapsed but reachable
- [ ] Result card with price + Book Now + downloads remains directly attached to the render
- [ ] Lead-capture gate looks intentional: no blur strips, no trapped-card seams (Option A or B fully implemented)
- [ ] Gate still hides the render until submit; fields unchanged
- [ ] Loading state is branded, animated, uses selected colors, rotates status copy, no layout shift on completion, honors reduced-motion
- [ ] Download Quote verified working on a physical iPhone (Safari) and Android Chrome
- [ ] Every swatch's selected state is clearly visible; checkmark + ring contrast fixed across the full palette
- [ ] No pricing/booking/lead-contract regressions; works across tenants
- [ ] Build passes; changes verified in incognito on desktop + mobile
