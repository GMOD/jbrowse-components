---
name: gpu-shaders
description: How are GPU shaders authored and kept correct — generated modules, binding tables, WGSL-only validation, hi-DPI scaling, antialiasing ramp widths, the xyplot bar-top measurement and what the coverage band cannot antialias?
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
gen:shaders` (check its exit code). CI regenerates and diffs, and the build
refuses a `.generated.ts` no `.slang` produces any more.

**A shader's text is not on the module a consumer imports.** It lives in
`<base>.wgsl.generated.ts` and `<base>.glsl.generated.ts`; `SOURCE` is one
`import()` of each, awaited when a HAL is built
([EAGER_BUNDLE.md](EAGER_BUNDLE.md) §"Shader text loads when a HAL is built").
Held by `shaderSources.test.ts`, the `noShaderTextImport` lint rule and
`measureRegistryBundle.ts`.

**Binding tables are generated.** `BINDINGS` is the reflected `@binding` list; the
WebGPU HAL builds bind-group layouts from it (`bindGroupLayoutEntries`,
`hal/deviceGpuCache.ts`), as does `computePipeline.ts`. `pnpm gen:shaders` refuses
a render shader whose table the HALs cannot bind: uniform block at 1, optional
`Sampler2D` at 2/3, a second at 4/5.

- **Which stage reads a binding is the shader's answer, not the HAL's.** A
  hand-set layout hid the ramp from the vertex stage and WebGPU rejected both
  pipelines, so those displays silently drew on WebGL2.
  `assertStageReadsMatchWgsl` holds the build to the emitted WGSL, and
  `webgpuHalBindingVisibility.test.ts` builds every pass through the real
  `WebGPUHal`.
- **A sampler's filter comes from the module whose math needs it.**
  `//! texture-filter: [sampler] nearest | linear` has no default and is
  **inherited through `import`**. `rowTable` declares `nearest` because `(x + 0.5)
  / w` at a non-power-of-two width does not round-trip through a linear tap and
  silently lands a row on the wrong lane.

**One suffix, one meaning: `_BYTES` / `_WORDS` are units; `_F32` / `_U32` /
`_I32` are typed-array views.** `INSTANCE_OFFSET_F32` / `_U32` / `_I32` each hold
only fields of that Slang type, so writing a `uint` field through the f32 view does
not compile. A package that cannot import the plugin owning the `.slang`
(`alignments-core`) gets typed layouts through `layout-out`.

**Layout.** Display shaders live in `plugins/<plugin>/src/<display>/shaders/`,
per-plugin shared ones in `plugins/<plugin>/src/shared/shaders/`, cross-plugin
modules in `packages/render-core/src/shaders/`. A shape earns a module on two real
consumers with a live drift hazard
([ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md));
[SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) §"The shape library" holds the rules.

**The coverage band is the one shared *pass set*.** `coverageBand.slang` declares
the band's uniforms, geometry and five entry points; the pileup band and the MAF
band both declare them through `@jbrowse/alignments-core`'s `coverageBandMarks`.
The display owns where the band sits.

### WGSL validates what GLSL waves through

A shader can pass `pnpm gen:shaders`, run on WebGL2, and fail `createShaderModule`
on WebGPU. The only signal is a `[GPU] UNCAPTURED ERROR` / `GPUPipelineError` in a
WebGPU browser.

- **Derivatives (`ddx`/`ddy`/`fwidth`) must sit in uniform control flow.**
  Branching on a varying and taking a derivative inside the branch fails. Pick
  only the SDF per branch and run the derivative and ramp once after it
  (`pointMark.slang`), or compute every alpha before the branch (`wiggle.slang`).
- **A `max` blend takes no factors.** `BlendState` makes `{ op: 'max' }` a variant
  with no factor fields.

To check every shader at once, drive puppeteer at a **secure origin**
(`navigator.gpu` is undefined on `about:blank`) with a WebGPU-capable Chrome,
import each `*.generated.ts`, read `createShaderModule(...).getCompilationInfo()`,
and wrap `createRenderPipeline` in `pushErrorScope('validation')`.

## Canvas scaling & hi-DPI

**GPU canvases (HAL-managed):** uniforms are in CSS pixels and the HAL sets the
backing store to `css × dpr`. Do not scale by `devicePixelRatio`.

**2D overlay canvases** (`VisibleLabelsOverlay` and the like): the caller owns
DPR. Set `canvas.width = w * dpr`, call `ctx.scale(dpr, dpr)`, and put CSS
`width`/`height` in the style, as `prepareCanvas`
(`packages/render-core/src/canvas2dUtils.ts`) does. Skipping this blurs on Retina.

## Antialiasing ramps: how wide, and where the width comes from

**`packages/render-core/src/shaders/antialias.slang` is the rule.** It holds both
ramp widths, the one ramp shape and `glyphEdgeAlpha`, and its header says which
width a shader gets.

The recurring bug is an **AA ramp whose width was measured with `fwidth`, and/or
whose geometry had no room for it.** `fwidth` is `|ddx| + |ddy|`, overshooting a
true gradient by up to √2. A too-wide *linear* ramp does not thicken a mark, it
dilutes it (the half-max contour does not move), so look for dilution, not a fat
line. The one `fwidth(` call site is `continuation.slang`'s barycentric wireframe
estimator, whose comment says why it stays; a second would justify a
`//! fwidth-ok:` directive.

The right width depends on what the SDF is measured in:

- **Distance already in pixels** (synteny `perpCoverage`, dotplot capsule, wiggle's
  capsule, the xyplot bar's horizontal cuts): `|∇d| = 1`, so the full width is
  `aaPx(dpr)`. Call `edgeCoverage(signedInkCssPx, dpr)`; a shader reaching it
  without a `devicePixelRatio` uniform fails `pnpm gen:shaders`
  ([ADR-098](../architecture-decision-records/adr-098-one-ramp-one-unit-and-the-build-checks-it.md)).
  **A varying set from the same screen y the vertex converts to clip is in this
  case** (`vertCoverage`, `barInkPx`).
- **Not a perpendicular distance in known units** (quad-local SDFs whose scale
  differs per shape, as in `pointGlyph` and manhattan; chevron's foreshortened
  `dist`): measure with `aaGradient`, taken as the **full** width.
- **Tiled cells** (hi-C bins): no per-quad AA at all, deliberately. Bins share
  exact edges, so antialiasing each produces seams. The same refusal covers marks
  that STACK (wiggle step-line quads, the coverage band's SNP/modification
  segments). See §"What the coverage band cannot antialias".

**There is one ramp shape, the linear `aaRamp`.** `scripts/aa_ramp_coverage_study.ts`
scores linear and cubic against exact pixel coverage of a straight edge: linear is
closer at every angle, and a band built as `ramp(d) - ramp(d - W)` is exact at
every width with linear. `aaSmoothRamp` is deleted, not deprecated. The linear form
takes the FULL ramp width where smoothstep took the half, so `aaSmoothRamp(d,
halfPx)` becomes `aaRamp(d, 2.0 * halfPx)`; getting it wrong still compiles at half
or double width.

The predicted cross-backend drift from the cubic-to-linear conversion was never
measured; see [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) § "The AA ramp
prediction outlived its instrument". A ramp change and the per-display MSAA
sample-count question
([ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md))
land on the same pixels, so record the commit any drift table was measured at.

**A ramp needs geometry to live in.** Widening one without padding the quad clips
it. The dotplot capsule quad is `halfWidth + aaHalfPx(dpr)` on both axes
([SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) §"The pad is the other half of every
coverage"). `dotplotCapsulePad.test.ts`, `glyphEdgeAlpha.test.ts` and
`syntenyFillPad.test.ts` mirror the shader in TS, so a `SYNC` comment keeps them
honest. **A model test cannot check an agreement it models from one source**:
`syntenyFillPad.test.ts` built the polygon and the analytic clip from one
`fillEdges`, so it could not catch a corner-to-edge pairing drift. `ribbonEdges` is
one pairing, so the property is structural.

The pad costs fill (`browser-tests/probe-dotplot-pad-cost.ts` measures it).
Headless Chrome's SwiftShader reports the pad as free; measure in a headed browser.

### Which backend disagreement is evidence, and which is not

Ask whether a change moves one backend or all at once. `pnpm
test:browser:compare` diffs `webgl` / `webgpu` / `canvas2d`. For a GPU-only change
Canvas2D is an independent render of the same marks, so "closer to Canvas2D"
replaces "looks better" with a number. It is **no oracle** for a change reaching
every path together: a `//! js-export`ed function whose twin Canvas2D and SVG call
(`fillShade`), or a constant a CPU path imports from the shader (hi-C's
`MIN_VISIBLE_ALPHA`). Those agree on the new answer, right or wrong, and need a
snapshot diff or an eye.

Hover has no suite: `browser-tests/hover-probe.ts` drives
`setHoveredInstanceIdx`, never the mouse (a miss is indistinguishable from a cue
that draws nothing), and requires a settled non-blank frame because the repaint
clears first.

### A bar's top edge is the datum, and it is measured

The xyplot bar's top is the one edge where aliasing corrupts an *encoding*: the
reader takes the score off it. `wiggle.slang` therefore computes its own coverage.
`barInkPx` carries CSS px below each horizontal cut, the fragment differences two
`aaRamp`s, and the quad grows one device px past each cut, the ramp's full width,
so rasterizer coverage never multiplies the analytic one. `aaHalfPx` (the capsule
pad) is not enough: it uncrops the ramp but leaves the fringe pixel partly covered.
Both cuts are needed: a single top ramp against a hard baseline paints a
half-covered row under a zero-height bar, a dotted line along the origin on a
wiggle of zero bins.

**Neighbouring bars share pixel columns.** `extendToMinWidthX` floors a bin at
`MIN_FILL_WIDTH_PX`, so bars overlap two or three deep. Where tops agree the fringe
row composites `1 - (1 - a)^n` instead of `a`, a residual top error MSAA's
coincident coverage did not have. The change still wins, as the table shows.
Multi-row multiwiggle adds an opposite-sign case, where edge-to-edge rows composite
two tiled edges to 0.75 instead of 1.0 (separator lines default off, so nothing
covers it).

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

The shape that would let the band go analytic is §5 of
[ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md):
draw a position's whole stack as ONE primitive and derive the segment in the
fragment.
