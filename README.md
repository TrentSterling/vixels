# VIXELS

Vector materials for voxel surfaces. One static HTML file, WebGL2, no framework, no network requests.

Live: https://tront.xyz/vixels/

Vixels is an independent graphics experiment: materials are authored as complete vector
contours (polygons, circles, rounded rects, line + quarter-arc paths) in a 24x24 space,
compiled into small data textures, and evaluated analytically in the fragment shader.
A low-resolution lookup grid is only an acceleration structure; the artwork is not
defined by the grid, and changing the grid resolution must not change the picture.

The name is a placeholder. It is deliberately not "Rixels" (4J Studios' name for their
Reforj texture tech, which inspired this). Nothing here claims to reproduce their
implementation. See `HANDOFF.md` for the cleanroom rules.

## What is in the build

- **Surface / Block / Chunk** scene modes, each with its own camera
- 12 original vector materials: lichen, masonry, alloy, grass top, grass side, dirt, sand, stone, ore, log, leaves, end grain
- 16x16x16 procedural voxel chunk, visible-face meshing grouped by material, vertex AO
- Debug views: material, normals, contours, bin occupancy, lookup-grid overlay
- Data-texture memory ledger (numeric arrays, not SDF bitmaps)
- Filtered 64x64 color + normal caches for minification, counted in the ledger
- Exports: vector JSON, flat SVG, PNG snapshot
- Test hooks on `window.VIXELS` (grid invariance test, face audit, frame fingerprint)

## Controls

| Action | Input |
|---|---|
| Pan / Orbit tool | `P` / `O` or the buttons |
| Pan override | Shift + drag, right drag, middle drag, Space + drag |
| Zoom | wheel, `+` / `-` |
| Focus point | double-click a surface |
| Fit scene | `F` |
| Screen-space pan | arrow keys |
| Scene mode | `1` Surface, `2` Block, `3` Chunk |
| Touch | one finger = tool, two fingers = pan + pinch |

## Files

```
index.html      the build (source of truth)
HANDOFF.md      project handoff: architecture, rules, non-regression checklist
versions/       exact copies of each handed-off build
tools/          headless Chrome checks (node tools/verify.mjs [url])
```

## Verify

```
node tools/verify.mjs                       # local file
node tools/verify.mjs https://tront.xyz/vixels/
```

Boots the page in headless Chrome (SwiftShader), checks all three modes render, every
material is selectable, runs the GPU grid-invariance test, the chunk face audit, and
confirms zero external requests. Screenshots land in `tools/out/`.

Prior art worth reading: Nehab and Hoppe, "Random-access rendering of general vector graphics" (2008).
