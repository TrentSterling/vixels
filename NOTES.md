# NOTES

Working notes for whoever picks this up next (human or model). `HANDOFF.md` is the
long-form handoff and wins on any conflict. Read it first.

## Status (2026-09-17)

- Build `Vixels Forge 02.1` hosted as-is at https://tront.xyz/vixels/ (exact bytes of
  the handed-off `vixels-forge-fixed.html`; copy kept in `versions/`).
- Lineage before this repo: Gemini brainstorm thread (ideas only, not spec), then a
  ChatGPT build thread that produced Forge 02.1. Earlier per-cell SDF stamp designs are
  dead ends; the current design is whole contours + random-access lookup grid.

## Deploy

1. Edit `index.html` (or drop a new build in, keep a copy in `versions/`).
2. `node tools/verify.mjs` must be green locally.
3. Commit, push to `main`. Pages serves the repo root.
4. `node tools/verify.mjs https://tront.xyz/vixels/` against the live origin.

## Open follow-ups

- Done 2026-09-17: em dash sweep, OG image (`tools/og-shot.mjs`, chunk framing), meta tags, games page card.
- Then the real work: HANDOFF.md section 20 (materials, chunk presentation, perf
  instrumentation, compression, authoring tooling).
