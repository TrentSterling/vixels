# VIXELS / SDFIXELS — PROJECT HANDOFF

You are taking over an experimental graphics project from another LLM. I am Trent / Tront, a Unity/C#/VR/game-dev programmer. I care much more about the underlying rendering idea, correctness, performance, and useful developer tooling than about flashy AI-generated UI.

You will be given the latest source/build files. READ THEM FIRST.

The current source of truth is the latest fixed Vixels Forge build, currently named something like:

- `vixels-forge-fixed.html`
- possibly an accompanying source ZIP

Do not reconstruct this project from an old prompt. Continue from the latest working implementation.

---

# 1. THE PROJECT GOAL

This is a cleanroom experiment inspired by the publicly described texture technology used by 4J Studios in Reforj, which they call "Rixels."

The public description says, broadly:

- they use vector shapes instead of ordinary raster texels
- publicly described material mentions 23 vector shapes
- they report replacing much larger conventional texture data with a much smaller representation
- the point is extreme magnification without normal bitmap blur and reduced memory use

HOWEVER:

DO NOT CLAIM WE KNOW THEIR IMPLEMENTATION.

Do not say we have reproduced their exact system.
Do not say we know their packing scheme.
Do not say they use SDFs internally.
Do not make patent-safety claims.
Do not copy proprietary assets or try to reconstruct unseen proprietary code.

Our implementation is an independent graphics experiment built from ordinary published graphics concepts:
- vector graphics
- signed distance / analytic distance evaluation
- random-access vector rendering
- spatial binning
- data textures as structured GPU storage
- derivative-based antialiasing
- raster/mip fallback for minification

One especially relevant public prior-art direction we found was:

**Nehab & Hoppe, "Random-access rendering of general vector graphics" (2008)**

That paper was a major conceptual unlock for the project.

---

# 2. NAMING

Naming is NOT FINAL.

Names used so far:

- Vixels
- SDFixels
- Vector pixels
- Contour materials
- Vixels Forge

Trent dislikes calling our system "Rixels." That is 4J's name, and "rixel" already historically means rotated pixel in other contexts.

Do not spend time bikeshedding the name unless asked.

For now, preserving `Vixels` in the UI is fine.

---

# 3. THE BIG ARCHITECTURAL IDEA

The current system is NOT:

> one tiny SDF bitmap per cell

and it is NOT:

> one canned shape stamped independently into each grid cell

That was an earlier dead-end.

The current system authors **complete vector regions first**, then uses a low-resolution grid ONLY as an acceleration structure.

That distinction is extremely important.

A shape can span several lookup cells without being broken apart.

Pipeline:

    vector document
        ↓
    complete shapes / contours
        ↓
    compile geometry into GPU data textures
        ↓
    spatial lookup grid says which shapes might affect a UV
        ↓
    fragment shader fetches candidate shape records
        ↓
    analytic signed distance is evaluated on demand
        ↓
    coverage / color / contour normal / lighting
        ↓
    distant views can blend toward filtered raster caches

The grid serves the artwork.

The artwork is NOT defined by the grid.

That is one of the strongest things about the current implementation.

---

# 4. AUTHORING MODEL

The material exists in a normalized 24×24 authoring space.

Currently supported shape types:

1. Polygon
2. Circle
3. Rounded rectangle
4. Closed path containing:
   - straight segments
   - axis-aligned quarter-circle arcs

A document contains roughly:

    {
        format
        dimension
        palette
        background
        shapes[]
        focus
    }

Shape data can include:

- type
- palette/color index
- geometry
- height / relief amount
- optional parent shape

Parent relationships are important.

A child can be a paint region clipped inside a parent silhouette.

Example:

A stone may have:
- cream top paint
- gray center paint
- olive underside paint

but all those colors can share ONE parent stone silhouette for relief shading.

Therefore a paint boundary does not automatically produce another raised seam.

This was an important improvement over the earlier demos.

---

# 5. GPU DATA LAYOUT

The current system uses several very small textures as GPU-readable structured arrays.

These are DATA TEXTURES, not conventional pictures.

## Headers

Integer texture.

One entry per acceleration-grid cell.

Stores:

    start offset
    candidate count

Conceptually:

    Cell (5,7)
        start = 480
        count = 3

means:

    candidate entries 480,481,482 may affect this area

---

## Candidate indices

Integer texture.

Each entry identifies a shape.

It also packs wrap/tile offsets so shapes crossing the repeating material boundary can still be evaluated correctly.

---

## Primitive / shape records

RGBA32F.

Four RGBA texels per shape.

Stores things such as:

- primitive type
- geometry start offset
- geometry count
- palette index
- center / dimensions / radius
- relief height
- parent ID
- winding/orientation
- AABB bounds

---

## Vertex texture

RG32F.

THIS IS LITERALLY A VERTEX ARRAY STORED IN A TEXTURE.

One texel:

    R = vertex X
    G = vertex Y

Example:

    shape record:
      type  = polygon
      start = 120
      count = 3

    vertex texel 120 = (2,3)
    vertex texel 121 = (6,3)
    vertex texel 122 = (4,7)

The shader fetches those vertices and evaluates the triangle/polygon mathematically.

There is no grayscale SDF stored for the triangle.

The signed distance is calculated at the fragment's position.

---

## Arc / path texture

RGBA32F.

Used for line/quarter-circle path segments.

Contains start/end coordinates plus arc center/radius/type information.

---

## Palette texture

RGBA32F.

Actual material colors.

---

# 6. HOW ONE FRAGMENT IS SHADED

Conceptually:

    UV
      ↓
    locate acceleration-grid cell
      ↓
    read [candidate start, candidate count]
      ↓
    loop only those candidate shapes
      ↓
    fetch shape record
      ↓
    conservative AABB reject
      ↓
    evaluate analytic distance
      ↓
    optionally evaluate parent clipping shape
      ↓
    turn distance into antialiased coverage
      ↓
    fetch palette color
      ↓
    accumulate visible layers
      ↓
    derive contour relief normal
      ↓
    lighting

Inside = negative distance.
Boundary = zero.
Outside = positive.

For a circle this is basically:

    d = length(p - center) - radius

For polygons, the shader finds the nearest edge and performs an inside/outside crossing test.

For arc paths it evaluates line and circular-arc segments.

---

# 7. ANTIALIASING

Do not regress this back to naive:

    fwidth(selectedCellDistance)

The current system operates using continuous material coordinates and projects screen-space derivatives onto the analytic distance gradient.

This matters because a fragment crossing from one acceleration cell into another may select a different branch/candidate set.

The artwork must remain continuous even though the lookup structure is discrete.

The acceleration grid MUST NOT become visible in the final material.

There is a debug grid mode specifically for inspecting it.

---

# 8. MINIFICATION / DISTANT VIEWING

Analytic vector edges solve magnification beautifully.

They do NOT magically solve arbitrary minification.

Tiny repeating vector structures at distance/grazing angles can shimmer.

The current implementation therefore has filtered LOD support:

- 64×64 color cache
- 64×64 normal cache
- mipmapped
- generated from the whole analytic material
- blended in at minification

This is deliberately counted in the memory ledger.

Do NOT make fake memory claims by conveniently excluding required supporting textures.

The current philosophy is:

**measure the actual implementation we built.**

Not:

**invent a theoretical 512-byte number and advertise it as the whole renderer.**

---

# 9. THE MATERIAL LIBRARY

Latest build has 12 surfaces:

- Lichen
- Masonry
- Alloy
- Grass Top
- Grass Side
- Dirt
- Sand
- Stone
- Ore
- Log
- Leaves
- End Grain

These are original procedural/vector materials.

The voxel materials are intentionally split where Minecraft-style blocks need different faces.

Example:

Grass block:
- top → `grassTop`
- side → `grassSide`
- bottom → `dirt`

Log:
- vertical side → `log`
- top/bottom → `logEnd`

Continue improving these.

The biggest visual target is NOT "more random shapes."

It is:

**more coherent, connected, authored macro-forms.**

The original Reforj reference was appealing because shapes visually connect into:
- large stone forms
- chiseled ridges
- bands
- layered surfaces
- curved multi-part features

Random stickers are bad.

Procedural oatmeal is bad.

Connected graphic structure is good.

---

# 10. CURRENT VOXEL / MINECRAFT TEST

The latest build contains a simple procedural:

    16 × 16 × 16

voxel chunk.

It is intentionally small.

Terrain includes:

- grass
- dirt
- stone
- ore
- sand
- logs
- leaves

There are two simple trees.

Current meshing is:

**visible-face meshing grouped by material**

It is NOT one draw call per cube.

Faces hidden against solid neighboring voxels are removed.

The resulting exposed geometry is grouped into material batches.

There is also simple vertex AO derived from neighboring voxel occupancy.

Current chunk materials therefore demonstrate that the same analytic material system can be used as Minecraft-style block surfaces.

IMPORTANT:

The chunk geometry itself is ordinary triangle geometry.

The SDF/vector system is used for SURFACE SHADING.

Contour relief currently perturbs normals.

It does NOT displace block silhouettes.

---

# 11. CHUNK IMPROVEMENTS WORTH EXPLORING

Possible future work:

- greedy meshing
- better biome/terrain generator
- more block types
- caves
- multiple chunks
- chunk streaming
- better material transitions
- per-face rotations/variants
- material variation without creating hundreds of unique material objects
- stronger AO
- far-chunk LOD
- real performance instrumentation
- block picking/editor
- texture/material authoring inspector

Be careful with greedy meshing.

Every voxel face currently naturally maps the full vector material UV 0→1.

If merging several faces, preserve intentional block-space material repetition. Do not stretch one material over an entire giant greedy quad unless that is explicitly desired.

---

# 12. CAMERA UX — DO NOT REGRESS THIS

An earlier version was annoying because Trent could basically orbit but could not comfortably MOVE around the scene.

That has now been fixed.

Camera navigation is a non-regression requirement.

There are THREE independent scene modes:

    Surface
    Block
    Chunk

Each stores its own camera state.

Controls:

## Tool modes

**Pan**
- button
- `P`
- left drag pans

**Orbit**
- button
- `O`
- left drag orbits around current target

## Pan overrides

These must ALWAYS pan regardless of selected tool:

- Shift + left drag
- right drag
- middle drag
- Space + drag

## Other controls

- wheel = zoom
- Surface mode zoom follows mouse position
- double-click visible surface = focus that point and make it the orbit/zoom target
- F = fit whole current scene
- arrow keys = screen-space pan
- + / - = zoom
- 1 / 2 / 3 = Surface / Block / Chunk
- touch:
  - one finger = selected camera tool
  - two fingers = pan + pinch zoom

Panning is performed in CAMERA SCREEN SPACE.

Do not implement world-X/world-Y panning that becomes nonsensical after rotating the camera.

The current Fit code inspects the actual rendered mesh extents in camera space and frames them.

Keep this good.

---

# 13. CURRENT UI DIRECTION

Trent explicitly complained about generic modern LLM UI.

Avoid:

- giant rounded cards everywhere
- generic glassmorphism dashboards
- huge gradient hero regions
- icon-only controls
- excessive explanatory prose
- default lil-gui-looking developer demos
- "every ChatGPT site looks like this" aesthetics

Current UI intentionally moved toward a restrained graphics-tool / engine-tool aesthetic:

- small radius
- visible borders
- normal-sized text
- muted olive/gray palette
- explicit text labels
- compact material rail
- viewport-first layout
- clear Surface / Block / Chunk tabs
- real camera-tool buttons
- responsive/mobile behavior

There is NO CSS framework.

There are NO downloaded fonts.

The latest version also dropped its runtime Three.js dependency and uses an included direct WebGL2 renderer.

Do not reintroduce CDN failure as a boot dependency without a strong reason.

A Three.js branch is fine as an experiment, but the standalone WebGL2 build is currently valuable because:

- one HTML file
- no server
- no external network requests
- no dependency failure
- shader/data path is completely explicit

---

# 14. DEBUG / INSPECTION MODES

Current shader inspection includes:

- Material
- Surface normals
- Contours
- Bin occupancy
- acceleration-grid overlay

There is also a data-texture diagnostics section showing the memory allocations.

The UI explicitly explains:

> Numeric arrays, not SDF bitmaps.

This distinction should remain obvious.

Developers looking at this project repeatedly ask:

> "Where are the SDFs stored?"

Answer:

**They aren't stored as SDF images.**

Shape PARAMETERS are stored.

Distances are evaluated analytically in the shader.

---

# 15. EXPORTS

Current build supports:

- vector JSON export
- flat SVG export
- viewport PNG snapshot

SVG export is useful because it makes clear that these materials are genuinely vector-authored geometry.

Keep round/arc geometry as actual curves when possible rather than flattening everything into tons of polygon points.

---

# 16. TESTING / QA HOOKS

The latest source exposes:

    window.VIXELS

Useful members include things similar to:

    VIXELS.ready
    VIXELS.busy
    VIXELS.errors
    VIXELS.state
    VIXELS.camera
    VIXELS.device
    VIXELS.statistics

    VIXELS.setMode(...)
    VIXELS.fit()
    VIXELS.render()
    VIXELS.gridTest()
    VIXELS.macro()
    VIXELS.setTool(...)
    VIXELS.select(...)

    VIXELS.flatPixels(...)
    VIXELS.frameFingerprint()
    VIXELS.faceAudit()
    VIXELS.testLog

USE THESE.

The grid test compiles/renders a material using:

    8×8
    16×16
    24×24
    32×32

acceleration grids and checks that GPU albedo stays identical.

This tests the fundamental invariant:

**changing the lookup acceleration structure must not change the artwork.**

The voxel geometry also has audits for:

- face winding
- side-face UV orientation
- accidentally emitted hidden faces

---

# 17. IMPORTANT QA LESSON FROM THE PREVIOUS HANDOFF

DO NOT JUST RUN A SYNTAX CHECK AND CALL THE BUILD FINISHED.

This already burned us once.

A previous build passed JS syntax checking but booted to a completely empty viewport.

Cause:

some procedural material generators were producing illegal rounded rectangles where:

    radius > half of the smallest dimension

Strict validation correctly rejected them.

Unfortunately the exception occurred during startup/swatches, so the renderer never became usable.

That has been fixed by bounding authoring-helper radii while keeping document validation strict.

The UI now also displays a REAL startup error instead of silently leaving an empty canvas.

Before telling Trent a build works:

1. Actually launch it in a browser.
2. Wait for boot to finish.
3. Verify canvas is not blank.
4. Verify no JS exceptions.
5. Verify no shader compile/link errors.
6. Verify no unexpected network dependency.
7. Screenshot the result.
8. Test Surface.
9. Test Block.
10. Test Chunk.
11. Switch several materials.
12. Test orbit.
13. Test explicit Pan mode.
14. Test right-drag / middle-drag / Shift-drag pan.
15. Zoom.
16. Double-click focus.
17. Fit the scene again.
18. Toggle Contours.
19. Toggle Bin Occupancy.
20. Change lookup-grid resolution.
21. Run grid invariance test.
22. Rebuild/reseed the terrain.
23. Test at a narrow/mobile viewport.

If you don't visually inspect the renderer, the task is NOT done.

Trent WILL notice.

---

# 18. EARLIER GEMINI EXPERIMENTS — IMPORTANT WARNING

Before the current implementation there was a long Gemini brainstorming/build thread.

It produced useful ideas, but also a lot of confident bullshit.

Do NOT treat those outputs as specifications.

Examples of ideas that should NOT be accepted without measurement/evidence:

- "32×32 must be faster because GPUs love powers of two"
- "this entire material is only 512 bytes"
- "normal-map cost is zero therefore total material cost is effectively zero"
- "any 16×16 PNG can automatically be converted into perfect SDF vectors"
- "we know exactly how 4J implemented Rixels"
- "this is definitely patent-safe"
- fake raster comparisons made by averaging cells instead of honestly baking the analytic artwork
- reconstructing the target artwork with repetitive vertical stripes and scattered decorative icons

Those versions were stepping stones, not ground truth.

The current complete-contour + random-access geometry architecture superseded them.

---

# 19. WHAT MADE THE CURRENT ARCHITECTURE BETTER

The important conceptual leap was:

OLD:

    fixed grid cell
      → choose canned SDF stamp
      → art is fundamentally made of independent cells

CURRENT:

    author whole contour
      → compute spatial bounds
      → grid only tells GPU which whole contours might matter here
      → evaluate actual contour continuously

This makes:

- curves continuous
- large shapes possible
- connected forms possible
- lookup resolution independent of artwork
- SVG export meaningful
- normals coherent across painted subregions
- material design much less "tile stamp"-looking

Keep that.

---

# 20. NEXT DEVELOPMENT PRIORITIES

Do not immediately rewrite everything.

First inspect the current build and identify the weakest areas.

My preferred next focus would be roughly:

## A. MATERIAL QUALITY

Push the 12 materials much harder.

Especially voxel materials.

Aim for stronger authored structure and recognizable material logic.

Examples:

Grass:
- coherent clumps
- layered turf
- subtle soil peeking through
- edge shapes that actually look like hanging vegetation

Stone:
- larger connected fracture/facet systems
- convincing chiseled planes
- avoid uniform brick wallpaper unless specifically making bricks

Ore:
- ore seams/clusters that cross arbitrary lookup bins
- leverage the fact that we are NOT limited to one stamp per cell

Wood:
- connected grain ridges
- knots
- cut-ring structure
- side/end distinction

Leaves:
- layered canopy forms
- readable negative spaces
- not random green circles

Alloy:
- panels that form intentional industrial structures
- vents / bolts / channels / insets
- restrained repetition

## B. CHUNK PRESENTATION

Make the voxel demo feel like an actual tiny terrain tech demo, not merely cubes with materials.

Possible:
- nicer terrain composition
- slightly better tree shapes
- ore exposure
- little overhang or cliff
- water only if it materially improves the comparison
- sensible sun/studio lighting
- camera framing worthy of screenshots

## C. PERFORMANCE

Start measuring.

Collect:

- frame CPU time
- GPU time if feasible
- fragments
- candidate count distribution
- shape edge evaluations
- texture fetch estimate
- material data memory
- chunk vertex count
- chunk draw count
- raster-cache memory
- WebGL texture allocation formats

Test pathologically complicated materials.

The entire point of this experiment is partly whether this representation is ACTUALLY worthwhile.

Do not optimize purely from theory.

## D. DATA COMPRESSION

Current representation favors flexibility/correctness.

Later investigate whether we can reduce:

- float32 geometry
- primitive record size
- duplicated candidate indices
- palette precision
- shape coordinate precision

Possible directions:

- normalized 16-bit coordinates
- half floats
- smaller type-specific records
- shared geometry
- palette packing
- geometry deduplication
- better acceleration structure
- hierarchical bins

But preserve correctness while doing this.

## E. AUTHORING TOOLING

Eventually I want this to feel authorable.

Ideas:

- simple SVG import
- edit/select contours
- show vertex/arc handles
- click lookup bin and see candidate list
- visualize primitive records
- material complexity heatmap
- per-shape relief
- palette editor
- shape layer ordering
- export compact runtime representation

An SVG/vector workflow is more honest and useful than pretending arbitrary PNG→perfect-vector conversion is solved.

---

# 21. VISUAL TARGET / DESIGN PHILOSOPHY

The reference material that kicked this off was impressive because the vector regions formed a deliberate illustration.

Our earlier bad versions looked like:

> wood stripes with shapes pasted on top

Do not fall back into that.

We want:

- connected contours
- silhouette hierarchy
- broad value structures
- selective detail
- shapes crossing acceleration-grid boundaries
- multi-color paint inside one larger raised form
- subtle procedural variation secondary to intentional forms

Use the vector system because it can do things raster pixels and dumb cell stamps cannot.

---

# 22. PERFORMANCE REALITY

Do not assume this automatically beats normal texture compression.

Traditional GPU block-compressed textures are extremely mature and cheap.

Our renderer trades:

- less source texture data / extreme vector magnification

for:

- texture indirection
- candidate traversal
- dynamic branches
- geometry fetches
- edge-distance math
- potential divergence
- special minification handling

That trade can be good for some stylized games.

It is NOT universally superior.

Benchmark it.

Especially if we eventually care about:
- standalone VR
- Quest-class mobile GPUs
- tiled architectures
- large voxel worlds

---

# 23. CLEANROOM DISCIPLINE

Continue this as an independent research prototype.

Good:

- study public papers
- study general GPU/vector techniques
- write our own renderer
- make our own data format
- make our own artwork
- benchmark our own implementation
- compare raster/vector representations honestly

Bad:

- claim proprietary compatibility
- copy Reforj textures
- pretend PR screenshots reveal source code
- claim exact implementation details without evidence
- claim patent clearance

---

# 24. USER PREFERENCES / WORKING STYLE

Trent likes aggressive iteration.

He will give blunt feedback.

Do not get precious about a version.

He would rather receive:

- an actually working file
- visually checked
- profiled
- tested

than:

- long explanations about what you theoretically changed

If you change a build:

SHOW THE RESULT.

Take screenshots.

Test the actual interactions.

When he points out a visual problem, inspect the rendered frame rather than defending the code.

He is a programmer and cares about:
- shaders
- data layouts
- performance
- rendering architecture
- actual implementation details

He does not need basic GPU concepts overexplained.

---

# 25. HARD NON-REGRESSION CHECKLIST

Before handing back any major build, confirm:

[ ] single static HTML still works
[ ] no CSS framework
[ ] no required CDN/network request unless explicitly justified
[ ] Surface works
[ ] Block works
[ ] Chunk works
[ ] all material thumbnails render
[ ] materials are selectable
[ ] no blank boot
[ ] error state is visible
[ ] Pan mode works
[ ] Orbit works
[ ] Shift/right/middle/Space pan works
[ ] wheel zoom works
[ ] double-click focus works
[ ] Fit recovers scene
[ ] touch remains functional
[ ] contours debug works
[ ] normals debug works
[ ] bin occupancy works
[ ] lookup grid overlay works
[ ] 8/16/24/32 grids compile
[ ] acceleration grid does not alter artwork
[ ] terrain can regenerate
[ ] face UV orientation remains correct
[ ] no hidden voxel faces accidentally emitted
[ ] logical memory values reflect actual allocations
[ ] no fake raster comparison
[ ] no proprietary implementation claims
[ ] screenshots visually inspected before saying "done"

---

# 26. FIRST THING I WANT YOU TO DO

Open and study the latest HTML before modifying it.

Run it.

Use the existing test hooks.

Inspect all three render modes.

Understand the compiler and data textures before deciding to replace anything.

Then improve it incrementally.

My current broad goal is:

> Turn this from a convincing graphics experiment into an actually excellent vector-material + voxel-terrain technology demo.

I want better materials, better terrain presentation, stronger diagnostics, honest performance measurements, and increasingly useful authoring/debug tooling.

Do not throw away the parts that already work.

Make them better.