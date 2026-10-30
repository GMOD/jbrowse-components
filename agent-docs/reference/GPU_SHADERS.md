---
name: gpu-shaders
description: How are GPU shaders kept correct — generated modules, WGSL-only validation, hi-DPI scaling, antialiasing ramp widths, the xyplot bar-top measurement, what the coverage band cannot antialias, and how to score a pass's pixels on a real GPU?
kind: spec
---

# GPU shaders and antialiasing

How `.slang` sources become both backends' shaders and how their antialiasing is
kept honest. [GPU_RENDERING.md](GPU_RENDERING.md) is the hub.

## Shaders (Slang codegen)

`packages/shader-tools/src/build-shaders.ts` compiles each `.slang` to WGSL and
GLSL ES 3.00. slangc has no GLSL ES target, so `vulkanGlslToWebgl2.ts` adapts its
desktop GLSL down; the SPIRV-Cross alternative was declined in
[ADR-061](../architecture-decision-records/adr-061-webgl2-glsl-comes-from-the-regex-adapter.md).
Authoring conventions: [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md).

**Never hand-edit `*.generated.ts`.** Edit the `.slang` and run `pnpm
gen:shaders`. CI regenerates with `--no-cache` and diffs, and the build refuses a
`.generated.ts` no `.slang` produces any more.

- **`gen:shaders` stamps every artifact `// inputs: <hash> <slang path>`**. It
  hashes the `.slang` and its transitive imports with comments, indentation and
  blank lines removed, so a comment edit regenerates nothing.
- **`gen:shaders --check`** rehashes the sources without slangc, in under a
  second, and names every shader whose artifacts are stale, including one whose
  compile failed and left the old artifacts in place. `pnpm verify` runs it.
- **A rebuild compiles only what changed.** `.cache/shaders` keys each file's
  result on its stamp, the shader-tools source and the validators present: a
  full build of 75 files takes about 15 s cold and 1.5 s with nothing changed.
- **`gen:shaders --watch`** rebuilds on every `.slang` save.

**One suffix, one meaning: `_BYTES` / `_WORDS` are units; `_F32` / `_U32` /
`_I32` are typed-array views.** `INSTANCE_OFFSET_F32` / `_U32` / `_I32` each hold
only fields of that Slang type, so writing a `uint` field through the f32 view does
not compile. A package that cannot import the plugin owning the `.slang`
(`alignments-core`) gets typed layouts through `layout-out`.

### WGSL validates what GLSL waves through

A shader can compile for WebGL2 and fail `createShaderModule` on WebGPU.
`gen:shaders` runs Tint, the validator inside Chrome, through Dawn's node binding
(the `webgpu` devDependency, on Dawn's null backend, so no GPU is needed). naga
30 accepts both rules below where Tint refuses the first.
`packages/render-core/src/hal/webgpuHalDawn.test.ts` then builds, binds and draws
every pass through `WebGPUHal` on Dawn, which holds the vertex layout, blend
state and bind group layout to the same validation a browser applies.

- **Derivatives (`ddx`/`ddy`/`fwidth`) must sit in uniform control flow.**
  Branching on a varying and taking a derivative inside the branch fails. Pick
  only the SDF per branch and run the derivative and ramp once after it
  (`pointMark.slang`), or compute every alpha before the branch (`wiggle.slang`).
- **A `max` blend takes no factors.** `BlendState` makes `{ op: 'max' }` a variant
  with no factor fields.

## Scoring a pass's pixels on a real GPU

`node scripts/gpu-pixels/run.ts [fixture…]` draws a pass's generated WGSL at 4
samples and at 1 and scores both against an ideal scene. It answers whether a
pass draws at one sample without a visual trade, the question
`//! coverage: analytic` turns on.

- **How it draws:** on Dawn (the repo's `webgpu` package), through the HAL's
  own `pipelineRecipe`, so layout, blend and topology are production's.
- **The reference:** each fixture in `scripts/gpu-pixels/fixtures/` states its
  scene as shapes composited in draw order, and the harness supersamples it
  8×8 per device pixel. Judge one sample against it, not against the 4-sample
  render: a pass that ramps its own edges still differs under MSAA.
- **What it reports:** worst and mean per-pixel error, and for a translucent
  fixture the pixels blended twice and the holes. A fixture's `budget` makes
  the run exit 1 when its one-sample render regresses.
- **`--base=<ref>`** scores the pass's WGSL at a git ref beside today's, read
  through today's buffers, and warns when the interface moved since.
  **`--png=<dir>`** writes reference, 1x, 4x and the 1x error, stacked.
- **`--adapter=llvmpipe`** picks Mesa's software Vulkan (lavapipe), which
  scores every fixture within 0.1 of a percentage point of the Intel GPU here.
  The Shaders job in `push.yml` runs it on every push, so a fixture without a
  `budget` is a measurement and one with a budget is a gate.
- **`--supersample=32`** for a pass that measures its own coverage: the
  default 8x8 reference rounds a straight edge as 4x MSAA does, which reads
  such a pass up to ~5 points worse than it is.

## Canvas scaling & hi-DPI

**GPU canvases (HAL-managed):** uniforms are in CSS pixels and the HAL sets the
backing store to `round(css × dpr)`. Do not scale by `devicePixelRatio`.

**2D overlay canvases** (`MafRowOverlays` and the like) go through
`prepareCanvas` (`packages/render-core/src/canvas2dUtils.ts`), which sizes the
store and the box and scales the context. Skipping it blurs on Retina.

**The CSS box is the store over the dpr** (`syncCanvasSize`), within half a
device px of the extent asked for. A box spanning a fractional number of device px (1266 CSS
px at dpr 1.25 is 1582.5) made Chrome stretch the 1583 px store into it,
resampling every column; Firefox snaps the box to the store. The box goes in
`min-`/`max-` too, so a component's own React `width` cannot undo it.
Renderers still lay out against the extent, so at the far edge Canvas2D
half-paints the last device px and the GPU spreads the extent over the whole
store, a drift under half a device px that we accept.
A box past its extent counts as scrollable overflow: a canvas ending at a scroll
container's content edge needs an ancestor that clips. Track canvases have
`contain: strict` and the view roots have `overflow: hidden`. The MAF sequence
widget had neither, and below dpr 0.9 (browser zoom 80% and less) it gained 1 px
of scroll, or a scrollbar on content that fits.

## Antialiasing ramps: how wide, and where the width comes from

The recurring bug is an **AA ramp whose width was measured with `fwidth`, and/or
whose geometry had no room for it.** `fwidth` is `|ddx| + |ddy|`, overshooting a
true gradient by up to √2. A too-wide *linear* ramp does not thicken a mark, it
dilutes it (the half-max contour does not move), so look for dilution, not a fat
line. The one `fwidth(` call site is `sequenceCell.slang`'s, over an
axis-aligned px varying, where `fwidth` is the gradient; a second would justify a
`//! fwidth-ok:` directive.

The right width depends on what the SDF is measured in:

- **Distance already in pixels** (synteny `perpCoverage`, dotplot capsule, wiggle's
  capsule, the xyplot bar's horizontal cuts, the feature chevrons' arms):
  `|∇d| = 1`, so the full width is `aaPx(dpr)`. Call `edgeCoverage(signedInkCssPx, dpr)`; a shader reaching it
  without a `devicePixelRatio` uniform fails `pnpm gen:shaders`
  ([ADR-098](../architecture-decision-records/adr-098-one-ramp-one-unit-and-the-build-checks-it.md)).
  **A varying set from the same screen y the vertex converts to clip is in this
  case** (`vertCoverage`, `barInkPx`).
- **Not a perpendicular distance in known units** (quad-local SDFs whose scale
  differs per shape, as in `pointGlyph` and manhattan): measure with
  `aaGradient`, taken as the **full** width.
- **Tiled cells** (hi-C bins): no per-quad AA at all, deliberately. Bins share
  exact edges, so antialiasing each produces seams. The same refusal covers marks
  that STACK (wiggle step-line quads, the coverage band's SNP/modification
  segments). See §"What the coverage band cannot antialias".

### A bar's top edge is the datum, and it is measured

<!-- BEGIN GENERATED MEASUREMENT wiggle-bar-top-subpixel -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                          | mean top error (device px) | max   | columns with the top on a whole device px |
| ---------------------------- | -------------------------- | ----- | ----------------------------------------- |
| before, 4 samples (shipping) | 0.069                      | 0.102 | 179                                       |
| before, 1 sample             | **0.277**                  | 0.475 | **2,151**                                 |
| after, 4 samples             | 0.00                       | 0.00  | 179                                       |
| after, 1 sample              | 0.00                       | 0.00  | 179                                       |


<!-- END GENERATED MEASUREMENT wiggle-bar-top-subpixel -->

`shaders/barCutCoverage.test.ts` pins both properties. The independent check is the
cross-backend gate: Canvas2D antialiases that cut, so a correct shader moves TOWARD
it. Every pair that moved, fell:

<!-- BEGIN GENERATED MEASUREMENT wiggle-bar-top-backend-drift -->

_Generated by `pnpm autogen` — edit the source, not this block._

| snapshot pair                          | before | after | change |
| -------------------------------------- | ------ | ----- | ------ |
| targeted_bigwig-multibigwig-xyplot     | 0.15%  | 0.01% | -0.14% |
| targeted_bigwig-multibigwig-multirowxy | 0.11%  | 0.02% | -0.09% |
| fullpage_bigwig-multibigwig-xyplot     | 0.04%  | 0.00% | -0.04% |
| fullpage_bigwig-multibigwig-multirowxy | 0.04%  | 0.01% | -0.03% |
| targeted_additional-color-wiggle       | 0.39%  | 0.37% | -0.02% |
| targeted_bigwig-gc-skew                | 0.02%  | 0.00% | -0.02% |


<!-- END GENERATED MEASUREMENT wiggle-bar-top-backend-drift -->


### What the coverage band cannot antialias

**The same change does not go on the alignments coverage band**, because every
mark there shares a horizontal edge with another:

- `coverageSnp` / `coverageMod` segments **stack** (each accumulates `yOffset`), so
  per-fragment alpha on both sides of the shared edge composites to less than full
  ink and leaks the grey depth bar (Kilgard & Bolz's conflation, which MSAA avoids
  by keeping coverage exclusive per sample).
- The topmost segment's top **coincides** with `coverageBar.slang`'s depth-bar top
  when a position is fully mismatched. Ramping one puts a grey fringe above the
  column; ramping both puts up to 0.25 of one there.
- `coverageInterbase` is already `floor(… + 0.5)` on both y edges, deliberately.
