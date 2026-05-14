# Synteny shader: fundamental issues and next steps

## Status

**Canvas2D is the quality bar.** The WebGPU/WebGL2 synteny fill shader
(`plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/syntenyFill.slang`)
cannot match it with the current per-CIGAR-instance render architecture.
Every per-instance shading approach trades one artifact for another.

## The problem in one paragraph

A synteny feature with CIGAR detail is rendered as one quad per CIGAR op
(M, I, D, N, X). Adjacent ops share their slanted perpendicular edges
exactly — M's right edge is I's left edge. Each instance independently
applies sub-pixel antialiasing on its silhouette. With standard
`src-alpha`/`one-minus-src-alpha` blending, two adjacent fragments each
fading to ~0.5 coverage at the shared seam leave the framebuffer with
`I*0.5 + M*0.25 + bg*0.25` — 25% of the bg clear bleeds through. That
bleed is the wide pink fade visible at M/I (red/yellow) and M/D
(red/blue) boundaries in the WebGPU rendering. Canvas2D doesn't have
this because `ctx.fill()` is a single rasterization decision per
sub-pixel sample against the path — adjacent fills tile cleanly.

## What we tried, and why each per-instance approach failed

| Attempt | What it does | Result |
|---|---|---|
| Original smoothstep `cx` | Sub-pixel SDF AA on each instance's perpendicular edges | **Bleed** — ~25% bg shows through M/I and M/D seams; visible wide pink fade extending several pixels into yellow/blue triangles |
| Hard-step `cx = step(perpDist, halfPerpW)` for CIGAR | Each pixel claims for exactly one CIGAR tile; smoothstep retained for BASE | **Pixelated slants** — no bleed, but the slanted seam is at pixel-center precision so the edge stair-steps visibly (Canvas2D's path AA gives sub-pixel grayscale; hardware 4× MSAA on the polygon perimeter doesn't help because the discard test is per-fragment, not per-sample) |
| `cx = 1.0` for CIGAR + full perpendicular pad | Polygon overdraws by ~1 px each side; relies on rasterizer not on shader for coverage | **Halo** — later-drawn CIGAR overpaints earlier in the pad overlap region (D's blue extends ~1 px into M's red around the deletion triangle) |
| `cx = 1.0` for CIGAR + `pad = bulgeX` (=0 in linear mode) | Polygon edges coincide with ribbon edges; expected MSAA at the rasterizer to partition samples between touching polygons via top-left rule | **Test hang** — `synteny_canvas_done` never appears; suspected WebGPU pipeline failure at degenerate I/D apex polygons (top vertices at xL == xR collapse to a point) |

The four attempts cover the space: continuous coverage produces bleed,
binary coverage produces aliasing, no coverage with overlap produces
halos, no coverage without overlap dies at degenerate polygons.

## Why no per-instance attempt can win

The 25% bg bleed is a **blend-equation property**, not a shader bug.
`src-alpha`/`one-minus-src-alpha` cannot reconstruct full coverage from
two partial-alpha fragments at the same pixel. Premultiplied output
doesn't help. Pure additive blend would help but only with
clear-to-(0,0,0,0) and a guaranteed white-background canvas, and it
breaks for genuinely overlapping features (different alignments at the
same pixel become over-bright).

Hardware MSAA helps for **silhouette edges** where a polygon meets
background, but not for **shared edges between two adjacent fragment
shader invocations** — the discard/coverage test runs once per
fragment, so all MSAA samples within a fragment get the same answer.
Per-sample shading via `@interpolate(sample)` *would* solve this on
WebGPU but (a) only gives 4 grayscale levels at 4× (worse than
Canvas2D's path AA for near-horizontal silhouettes the recent shader
work specifically optimized for) and (b) has no equivalent in WebGL2
GLSL ES 3.00.

Canvas2D wins this fight because it rasterizes a path with a *single*
coverage decision per sub-pixel sample. The GPU equivalent of that is
to render the whole feature as one shape with internal color
transitions, not as N separate fragment-shaded polygons.

## The remaining path: per-feature refactor

Render each feature as a single instance. Carry the CIGAR breakdown
in a side buffer (texture or storage buffer) keyed by feature index.
The fragment shader recovers bp at this pixel and looks up which
CIGAR segment owns it, outputting that segment's color. SDF AA runs
once at the **outer feature silhouette** — there are no shared
slanted edges between draw calls because each feature is a single
draw call.

Sketch:

```
instance attrs (per feature):
  bp1Hi/Lo … bp4Hi/Lo     (feature corners, as today)
  baseColor               (M color — varies per feature for colorBy=query/syri/strand)
  featureId, qtl, padTop/Bottom (as today)
  cigarTexStart, cigarTexCount  (new — index into side buffer)

side buffer (per CIGAR op, R32G32B32A32_UINT texel or u32 storage):
  u_top_end                (cumulative ref-bp / total ref, as Float32 bits)
  u_bot_end                (cumulative query-bp / total query)
  op_kind                  (M/I/D/N → 3..6)
  reserved

uniforms (color table):
  colorI, colorD, colorN, colorX  (constant per colorBy scheme)

fragment shader (per pixel):
  recover t (Newton, as today)
  compute s, xLeft, xRight at this t
  scan the feature's CIGAR slice to find the op whose (top, bot)
    boundary intervals contain this fragment's projection
  output baseColor for M, indel uniform color otherwise
  apply SDF cx/cy AA at outer feature silhouette only
```

### Real complications, not glossed over

1. **Inversions break binary search.** For inverted alignments
   (`strand=-1`), the ribbon's screen-X at each CIGAR boundary is **not
   monotonic** in alignment progress at intermediate t — the ribbon
   crosses itself. Binary-search by alignment-progress works only for
   forward alignments. Two options:
   - **Linear scan** every op: O(N) per pixel. Fine at N=10–50 (typical
     synteny). Painful at N=1000+ (gappy long-read CIGAR) — ~35 ms of
     pure GPU math for a full-canvas render in that regime.
   - **Per-instance inverted flag**: forward features use binary
     search; inverted use linear scan. Two code paths. Adds a uniform
     and a vertex-shader output.
2. **WebGL2 side-buffer.** WebGL2 (GLSL ES 3.00) has no SSBOs in
   browsers. Cross-API requires a 2D texture (`RGBA32_UINT` via
   `texelFetch`). Slang supports this; HAL needs a per-region texture
   upload path that doesn't exist yet.
3. **Color-by recomputation.** Today `colorBy` change re-derives the
   `colors[]` array per instance. After refactor, M color is a
   per-instance attribute and indel colors are uniforms — the worker
   keeps emitting `kinds[]` for hit-test, but the GPU upload skips the
   per-CIGAR colors and re-uploads only the small color uniform table
   on `colorBy` change.
4. **Edge pass (`syntenyEdge.slang`).** Already per-feature in concept
   (it loops over `nonCigarInstanceCount`, all of which are
   `KIND_BASE_HIDDEN`/`KIND_BASE`). With per-feature refactor, there's
   only one instance type — the `nonCigarInstanceCount` distinction
   collapses to "all instances."
5. **Hit-test (`syntenyPickEngine.ts`).** Currently picks per-instance
   (one quad per CIGAR op). After refactor, picks per-feature; if a
   per-op pick is wanted (e.g., to tooltip the I op specifically), the
   same bp-to-op lookup the shader does is replicated in JS.
6. **Canvas2D + SVG renderers.** `Canvas2DSyntenyRenderer.ts` iterates
   `data.instanceCount` instances and draws each as its own path. After
   refactor, it iterates features and within each feature iterates the
   CIGAR side buffer, drawing one path per op. Same on-screen result,
   moved iteration boundary.
7. **Tests.** `GpuSyntenyRenderer.test.ts`,
   `buildSyntenyGeometry.precision.test.ts`,
   `Canvas2DSyntenyRenderer.test.ts` all assert per-instance counts and
   layouts that change. Browser test snapshots need re-capture.

### Estimated effort

- Multi-day, multi-file change touching 8–10 files in
  `plugins/linear-comparative-view` plus 1 file in
  `packages/core/src/gpu` (HAL texture upload), plus test updates.
- No new precision/numerical territory — the math is mostly
  rearrangement of existing hp-math.
- Risk is in surface area, not algorithm.

### Speed assessment (honest)

Roughly **equal** to the current per-CIGAR approach, not clearly
faster:

- **Vertex shader savings:** ~20× fewer instances → ~20× less vertex
  work. Real.
- **Fragment shader cost:** +O(N) (linear scan) or +O(log N) (binary
  search) per pixel for the CIGAR lookup. ~5–10 cache-friendly texel
  fetches per pixel at typical N.
- **No pad overlap overdraw:** roughly cancels the added fragment work.

Net is approximately even on a fragment-bound GPU. The win is
**quality**, not speed.

## Current state of the branch

`webgl-poc` currently has Phase 1 (`cx = step` hard-cut for CIGAR
instances, `kind` attribute added at ATTR13). This eliminates the
~25% bg bleed at M/I and M/D seams but leaves the slanted seams
pixel-step aliased.

Decision points:

1. **Revert Phase 1** and ship the per-feature refactor as one commit.
2. **Keep Phase 1** (less-bad than original) and ship the per-feature
   refactor on top of it as a follow-up.
3. **Revert Phase 1 and live with the original bleed** until the
   per-feature refactor is done.

If we keep Phase 1, the regression-vs-Canvas2D is "pixel-step slanted
seams" rather than "wide pink bleed at slanted seams" — both are
visible quality artifacts compared to Canvas2D.

## Out of scope / future ideas

- **Sample-rate shading (WebGPU-only path).** Would give 4× grayscale
  AA at slanted seams. Worse than Canvas2D for near-horizontal
  silhouettes (which the current SDF AA handles well). Two-backend
  divergence with WebGL2.
- **Stencil-based per-feature ownership.** Stamp feature ID into
  stencil on the first draw of each feature; subsequent CIGAR ops test
  stencil to discard where another feature drew. Solves the
  inter-feature case but not the intra-feature CIGAR seam.
- **Render-to-texture per feature + composite.** Each feature renders
  to its own texture with no AA; final pass composites textures with
  SDF AA at the silhouette. Equivalent in result to the per-feature
  refactor but adds a render target per feature.
- **Switch to additive blend with alpha-zero clear.** Mathematically
  correct for adjacent tiles but breaks overlapping-feature rendering
  and requires the canvas's CSS background to be guaranteed white.

## Files changed in this exploration (on `webgl-poc`)

- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/syntenyTypes.slang`
  — added `kind: ATTR13` to Instance struct
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/syntenyFill.slang`
  — added `isCigar` varying, branched fragment shader for hard-step on CIGAR
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/instanceInterleave.ts`
  — writes `kinds[i]` to the new attribute slot
- regenerated `*.generated.ts` shader bindings
