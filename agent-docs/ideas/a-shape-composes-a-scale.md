---
name: a-shape-composes-a-scale
description: render-core already holds a shape module (rowRect.slang) and a scale module (scoreScale.slang) and has never composed them. Re-measured 2026-08-28, "a per-instance scalar through a ramp" is one channel cardinality but only its RAMP half factors — HiC and LD share the Sampler2D LUT mechanism down to the binding slot, while the three normalizers (scoreScale; HiC's mapHicCount, pinned cross-backend; LD's remap-plus-sentinel) stay per-consumer, and density already composes scoreScale. The plan composes rowRect × scoreScale × a LUT ramp on wiggle density first, because density's autoscale domain is a uniform and a CPU-side colour resolve would turn a pan into a buffer re-upload; the gates are pan cost in bytes uploaded, wiggle.slang shrinking, and a GPU/Canvas2D/SVG ramp-entry parity sweep. Step 2 landed 2026-08-28 — wiggleDensity.slang composes rowRect's factored geometry with scoreScale over the existing fill buffer, all three gates measured and passing in its section. Step 3 landed the same day: colorRampLut.slang + uploadColorRampLut are the one ramp mechanism, HiC and LD moved onto both halves (Gate D), and a named density ramp is the densityColorRamp slot — a uniform flag and one LUT upload, no new shader, parity within one LUT bucket. Step 4 (point as the second shape) is still open. Independent of ADR-089/090/091 on structural grounds: composition is compile-time slangc inlining that registers nothing and adds no runtime module edges, so ADR-091's reopening condition and the eager-bundle constraint do not govern it.
---

# A shape composes a scale

`packages/render-core/src/shaders/` holds a shape module and a scale module.
Nothing composes them.

- `rowRect.slang` (141 lines) is a shape: one instance is a rect spanning
  `[startBp, endBp)` on row `rowIndex`, filled with a per-instance packed ABGR
  colour. `maf.slang` (33 lines) and `multiRow.slang` (27 lines) are its two
  consumers, and its header records what it replaced — two byte-identical
  copies "joined only by a 'probably belongs there too' comment".
- `scoreScale.slang` is a scale: `normalizeScore(score, domainMin, domainMax,
  scaleType, symlogConstant)` plus the `SCALE_TYPE_LOG` / `SCALE_TYPE_SYMLOG`
  vocabulary its branches switch on. Its consumers reach it through
  `wiggleCommon.slang` and `coverageBand.slang`, and its header records the same
  history: two branch-for-branch copies that had already diverged on a
  degenerate domain.

Shape and scale are the two halves of a grammar's encoding — genome-spy spells
them `mark` and `scales`, and a channel binds a field to one of each. Both
halves are in this tree, in one directory, unjoined.

genome-spy factors at exactly this seam, which is independent confirmation the
factoring is the standard one: each mark's hand-written vertex GLSL calls
`getScaled_<channel>()` functions it never defines, generated per encoding by
`glslScaleGenerator.js` over a shared scale-primitive library, with domain and
range wired to uniforms updated on scale-resolution events so pan and zoom
never touch a vertex buffer. The difference this plan keeps is ADR-051's: the
composition here is a hand-written Slang import, never generated code.

## Four displays spell the missing half four ways

Colour cardinality across the live shaders, as measured before Step 2 landed —
density's row has since moved to `wiggleDensity.slang` (see Step 2's results),
and the `wiggle.slang` citations in it are the pre-move spellings:

| Shader | Colour is | Spelled |
| --- | --- | --- |
| `rowRect.slang` | a per-instance resolved value | `uint color : ATTR3`, packed ABGR |
| `arc.slang` | a per-instance index into a uniform palette | `float colorType : ATTR2` → `arcColorByIndex()` (`:366`) |
| `wiggle.slang` density | a per-instance scalar through an inline ramp | `float score : ATTR1` → `lerp(white, instColor.rgb, densityGradientT(norm, zeroNorm))` (`:159`, where `norm` is already `scoreScale`'s `normalizeScore`) |
| `hic.slang` | a per-instance scalar through a texture ramp | `float count : ATTR1` + `Sampler2D<float4> colorRamp` at `binding(2, 0)` |
| `ldGenomic.slang` / `ldUniform.slang` | a per-instance scalar through a texture ramp | `float ldValue` (`ATTR2` / `ATTR0`) + `Sampler2D<float4> colorRamp` at `binding(2, 0)`, via `ldUniforms.slang:57` |

The last three are one cardinality — the scalar stays in the instance buffer,
the mapping stays in uniform state — but the mechanism splits in half, and only
one half factors (re-measured 2026-08-28):

- **The ramp half factors.** HiC and LD reached the same answer independently,
  down to the binding slot and the premultiplied output, and LD's `ldRampColor`
  already takes the sampler as a parameter — half the shared module exists.
  Density is the weaker third: its ramp is arithmetic in the shader, which is
  why HiC offers viridis and fall (`colorRamp.ts:97`, `generateColorRamp` → a
  256-entry `Uint8Array`) and a density track can only fade from white to its
  track colour.
- **The scale half is three normalizers that do not unify.** Density already
  composes `scoreScale` — `wiggle.slang:157` calls `normalizeScore`, with
  `densityGradientT(norm, zeroNorm)` as a transfer function between scale and
  ramp. HiC's `mapHicCount` is not `normalizeScore` and cannot silently become
  it: different floors (`max(count, 1)` and `max(colorMaxScore, 2)` against the
  domain's-own-min rule), different degenerate-domain answers, and it is
  `js-export`ed precisely so Canvas2D and SVG land on the same LUT entry the
  GPU does — moving it onto `scoreScale` changes pinned cross-backend values.
  LD has no scale at all: values arrive in [-1, 1], and its "normalization" is
  an affine signed remap plus the `LD_NOT_COMPUTED` sentinel gate
  (`ldValueComputed`, -2 → transparent).

**That is the finding: the tree lacks neither half. It has one scale module
with real consumers, one ramp mechanism written twice, one inline ramp and one
palette index — and the composition worth building is shape × scale × ramp,
with the scale staying per-consumer.**

[ADR-090](../architecture-decision-records/adr-090-a-mark-is-a-shape-plus-its-channels.md)
ruled that a per-instance colour lane is "a second shape variant rather than an
option on this one" and was rejected with the factory
([ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)),
so the ruling binds nothing today. The table above is why it should not come
back: it describes `bar`, whose colour was a per-frame uniform, and `bar` was
the least expressive of the five.

## Why wiggle density is the consumer that forces the composition

Density's geometry is already `rowRect`. `wiggle.slang:135`:

```
if (u.renderingType == RENDERING_TYPE_DENSITY) {
  topPx = rowTop;
  botPx = rowTop + rowHeight;
}
```

A rect filling its row, from `startEnd` to `startEnd`, at `rowIndex` — which is
`RowRectInstance` with a `score` added. `multirowdensity` is the same shader
path (`renderingTypes.ts`); `rowIndex` and `numRows` are what make single-row
and multi-row one code path, so multiwiggle comes along at no extra cost.

**What stops density from simply becoming `rowRect` today is autoscale, and the
reason is architectural rather than cosmetic.** `domainYMin` and `domainYMax`
are uniforms — `GpuWiggleRenderer.ts:137` writes `state.domainY[0]` into the
uniform block — and autoscale resolves against the visible data, so the domain
moves on every pan (`wiggle-core/src/scoreRuleMarks.ts:30`). Because the score
stays in the instance buffer and the domain stays in a uniform, a pan costs one
uniform write. Resolve the colour on the CPU into a packed ABGR lane and the
same pan re-packs and re-uploads the whole buffer.

So the fourth cardinality is load-bearing. A shape library that cannot express
"a per-instance scalar through a uniform scale" has to choose between a new
shader per ramp and a re-upload per pan, and the tree has already chosen the
first four times.

## The plan

### Step 1 — Write the cardinality rule down

One ADR: **constant, per-instance value, per-instance palette index, and
per-instance scalar through a scale are cardinalities of one colour channel, not
four shapes.** The document describes what five shaders already do; it proposes
nothing.

Costs a document. No gate — a description of the tree cannot fail.

What it buys: the next shader that needs a ramp stops being a new shader, and
ADR-090's ruling does not return by default when someone reads it and does not
notice its status.

**Done 2026-08-28 —
[ADR-094](../architecture-decision-records/adr-094-colour-cardinality-is-one-channel-not-four-shapes.md).**

### Step 2 — Compose `rowRect` × `scoreScale` on wiggle density

Lift density out of `wiggle.slang`'s `renderingType` branch onto a composed
shape: `rowRect` geometry, `scoreScale` normalization, a ramp.

**Gate A: autoscale must stay a uniform write — instrumented as bytes uploaded
per pan, not writes counted.** Two real ways to fail it: resolve the colour
CPU-side into `rowRect`'s packed ABGR lane (the naive reading of
"`RowRectInstance` with a `score` added"), so a pan re-packs and re-uploads the
buffer; or put the domain into `installUpload`'s `inputs` getter, so an
autoscale move re-encodes every region — render-core's documented identity
trap. If the composition forces either, stop and record it — the cardinality
does not factor, and that is a result worth having.

A caveat on what Gate A proves: two shaders standing side by side, each keeping
its own scale and ramp, hold the pan property trivially. A passes a
non-composition; it discriminates only together with Gate B.

**Gate B: `wiggle.slang` must get simpler when density leaves.** The file
branches xyplot / density / scatter on one uniform and shares the clip-space
conversion between them. If removing one arm does not shrink the other two,
the branch was earning its place and the shape boundary is drawn wrong.

**Gate C: both backends and the export land on the same ramp entry, before and
after the move.** This is the gate the tree's history demands, where Gate A
guards a failure it has never had: HiC had to `js-export` `mapHicCount` so
three backends index one LUT, the alignments mark conversion found a live
GPU/Canvas2D divergence, and ADR-051's "drawn and exported are one boundary"
rule exists because this seam is where composition breaks here. It is cheap to
hold: `getDensityColor.ts` already quantizes the Canvas2D density ramp into 256
cached buckets, so the LUT form puts both backends on the same 256-entry grid —
sweep it the way `normalizeScoreParity.test.ts` sweeps the normalizer.

**Kill condition:** a parameter on the composed shape with exactly one caller.
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
declined a shared quad on a two-consumer bar for that reason and the reason
still holds.

**Landed 2026-08-28 — all three gates pass, kill condition clear.** The shape:
`rowRect.slang` factors `rowRectClipPos(startBp, endBp, rowIndex, vid,
RowRectUniforms)` — the geometry alone, callable independent of the colour lane,
with `rowRectVertex` now a caller of it — and `wiggleDensity.slang` is the
composed entry: rowRect geometry off a `RowRectUniforms` derived in the vertex
stage from wiggleCommon's own uniform block (`minCellPx` = `MIN_FILL_WIDTH_PX`,
`rowProportion` = 1, `scrollTop` = 0), `scoreScale` normalization, the inline
white-to-track-colour ramp unchanged. The instance struct is NOT
"`RowRectInstance` with a `score` added": it is the existing fill record,
declared once as `WiggleFillInstance` in `wiggleCommon.slang`, and the density
pass draws off `PASS_FILL`'s buffer via `drawPass`'s `bufferPassId` — the
`LineInstance` sharing precedent from slangPass.ts — so density gained no
packer and no buffer. `rowIndex` stays a float lane there (the buffer is shared
with xyplot/scatter, and the row transform is float arithmetic either way);
`rowRect`'s own struct keeps uint and each entry converts at its boundary.

- **Gate A: pass.** Jest + MockHal (`gpuWiggleRenderer.test.ts`, "a pan that
  moves the autoscale domain uploads zero buffer bytes"): a density region
  uploads 40 bytes (2 × 20-byte record); a pan whose autoscale moves `domainY`
  [0,20]→[0,35] uploads **0 buffer bytes** and costs one 64-byte uniform write
  per drawn block. Neither failure mode exists structurally:
  `packFillInstances(sources)` takes no domain, and `installUpload`'s `inputs`
  is `gpuProps()`, which carries no domain — the domain rides `renderState`,
  read per frame by the render autorun.
- **Gate B: pass.** `wiggle.slang` 217 → 183 lines (116 → 93 non-comment);
  `wiggleDensity.slang` is 79 (35 non-comment). The surviving arms did shrink:
  the shared y-span selection lost its density branch, the AA pad ternary
  (`drawsBar() ? barAaPx() : 0.0`) became unconditional, the vertex colour
  if/else and the fragment's density case left, and `import scoreScale`
  dropped. Support files grew by what moved, not by copies: rowRect.slang
  141 → 154 (the factored function), wiggleCommon.slang 102 → 118 (the shared
  struct).
- **Gate C: pass.** `densityColorParity.test.ts` sweeps 8 domain/scale/origin
  cases (linear/log/symlog, degenerate domain, origin ≠ 0, negative scores) ×
  3 track colours × 10 scores: the GPU chain (generated `normalizeScore` +
  `densityGradientT` + the mirrored lerp) lands within one LUT bucket — under
  2 8-bit channel steps — of `makeDensityRgbStringFn`, the pivot is white
  exactly on both backends, and the far domain end is the track colour exactly
  on the GPU side. One pre-existing sub-bucket wrinkle surfaced: the Canvas
  factory hoists the normalizer's reciprocal, so on symlog its endpoint t is
  0.99999… and one bucket short (`rgb(255,1,1)` for pure red) — present before
  the move, GPU-side exact after it. Before/after holds because the composed
  shader compiles from the same scoreScale/wiggleCommon functions the deleted
  branch called; the SVG path (`drawDensity` → `makeDensityRgbStringFn`) is
  untouched.
- **Kill condition: clear.** `rowRectClipPos` adds no parameter — its five are
  all exercised through `rowRectVertex` (MAF, multi-row) and by density — and
  `RowRectUniforms` gained no field; density writes 1.0/0.0 into
  `rowProportion`/`scrollTop`, fields the existing consumers exercise.

One deliberate behavior change: composing the shape brings `MIN_DRAWN_ROW_PX`
along, so a sub-pixel row (`numRows` > canvas height) paints at a floored 1px
and overlaps its neighbours where the old branch let it miss every pixel
center and drop out. Density and multirowdensity stay one code path — both map
to `RENDERING_TYPE_DENSITY` and differ only in `rowIndex`/`numRows`.

### Step 3 — The ramp is a texture, and the module is the ramp, not the scale

HiC and LD both bind `Sampler2D<float4> colorRamp` at `binding(2, 0)`; density
computes its ramp inline. The composed shape takes the texture form — it
already serves two displays and already carries viridis.

The open question this step shipped with — do HiC's and LD's ramps factor the
same way? — is settled (2026-08-28, the measurement in the cardinality section
above), and the answer rescopes the step: **the shared subject is a
ramp-sampling module plus one LUT upload path, and the scales stay three.**
`mapHicCount` stays HiC's, LD's remap-plus-sentinel stays LD's, `scoreScale`
keeps the consumers it has. Step 3 is not three consumers of `scoreScale`; it
is a third consumer for the ramp mechanism HiC and LD already share.

One constraint rides along: alpha. HiC's default juicebox scheme fades alpha
across its low counts and discards under `MIN_VISIBLE_ALPHA`, under
premultiplied blending; density is opaque under normal blending. The module
shares the sampling; the `//! blend:` declaration stays per-shader.

**Gauge: density gains an arbitrary ramp without a new shader.** Today a
density track can only fade from white to its track colour. On the texture
form, viridis on a density track is a uniform and a LUT upload.

**Gate D: the second consumer must reuse the LUT upload path, not merely import
the shader module.** Two shaders that sample the same way through two upload
paths is the divergence `scoreScale`'s header already documents, one layer up.
The kill condition governs this helper too — this is the one place the plan
adds shared *runtime* machinery rather than a compile-time import, and a LUT
upload path growing a scheme registry or per-display flags is the
parameter-with-one-caller failure wearing a helper's name.

**Landed 2026-08-28 — Gate D passes, gauge met, kill condition clear.** The
module is `render-core/src/shaders/colorRampLut.slang`: `rampColor(ramp, t)` —
the clamp + `SampleLevel(float2(t, 0.5), 0)` both consumers spelled — and
`rampColorPremultiplied` over it. Premultiplication went INTO the module, as
the second named entry rather than a flag: HiC and LD shared the
`float4(c.rgb * c.a, c.a)` line verbatim (it is half of what ADR-094's census
found factoring), so leaving it in each caller would recreate the two-copy
drift the module closes — while the `//! blend:` declaration stays per-shader
and the function name carries the contract, so density (opaque ramps, default
straight-alpha blend) calls plain `rampColor` and never inherits a transform
its blend does not match. Each consumer still declares its own
`[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp` — Slang has no way for a
module to declare a binding for its importer, so the binding-slot agreement
stays convention, checked by nothing new.

- **Gate D: pass.** The upload path is `uploadColorRampLut(hal, ramp,
  passIds)` (`render-core/src/colorRampLut.ts`, new `./colorRampLut` export):
  the 256×1 shape decision plus a byte-length check, nothing else. All three
  consumers went through it in the same change — `GpuHicRenderer` (one pass),
  `GpuLDRenderer` (its two shader variants are why the helper takes a pass
  list), `GpuWiggleRenderer` (the density pass, memoized on the cached LUT's
  identity) — and no `hal.uploadTexture` call is left under `plugins/`.
- **The gauge: met.** Viridis on a density track is the `densityColorRamp`
  config slot (stringEnum on `wiggleConfigSchemaFields`, default `'default'`,
  no menu built), which reaches the GPU as one uniform flag
  (`u.densityRampLut`) plus one 1024-byte LUT upload through the shared path,
  and zero new shaders — `wiggleDensity.slang` holds both modes, picked per
  fragment. Pinned in `gpuWiggleRenderer.test.ts`: a named ramp is one
  `uploadTexture` of the same cached bytes Canvas2D indexes, an autoscale pan
  in LUT mode still uploads 0 buffer bytes and re-uploads no texture, and the
  Step 2 Gate A test passes byte-identical (the uniform block grew the flag,
  so `UNIFORMS_SIZE_BYTES` moved with it through the generated constant).
- **The per-instance-colour tension the plan glossed, resolved as two modes.**
  Density's default ramp is parameterized by PER-ROW colour
  (`lerp(white, inst.color.rgb, t)`, multiwiggle), which one 256-entry LUT
  cannot encode — so the LUT is an alternative a config names, not a
  replacement, and the inline lerp stays the default. Holding both cost
  `wiggleDensity.slang` 10 non-comment lines (35 → 45; 79 → 97 with comments):
  a sampler binding, its own `DensityVsOut` carrying the flat ramp-position
  varying beside the resolved default colour, and a two-arm fragment. Not the
  "worse rather than better" finding the step reserved space for. Two
  structural costs worth naming: the vertex stage computes the default lerp
  even in LUT mode (a per-vertex `lerp` on six vertices, unmeasurably small),
  and a shader that owns a sampler unconditionally never draws on the WebGPU
  HAL until a texture arrives, so default mode binds a 1KB inert LUT once at
  first density draw (`UNUSED_RAMP`) that the flag keeps unsampled.
- **Parity: within one LUT bucket, ends exact.** `densityColorParity.test.ts`
  gained the LUT-mode sweep — the same 8 domain/scale/origin cases × 10
  scores, GPU mirrored as the generated `normalizeScore` +
  `densityGradientT` into a texel-exact model of the linear-filter
  clamp-to-edge `SampleLevel` both HALs configure — against
  `makeDensityLutFillFn` (`makeScoreNormalizer` + generated `densityGradientT`
  + render-core's `makeRampFillStyleLut`, the fillStyle LUT HiC's and LD's
  Canvas2D twins already index). Bound: the viridis LUT's steepest
  adjacent-entry step, 3 8-bit units, asserted per channel; the pivot is
  `LUT[0]` exactly on both backends and the far domain end `LUT[255]` exactly
  on the GPU side. Both backends and the SVG export read one table:
  `densityRampLut(name)` caches per name, the GPU uploads that identity, the
  Canvas2D/SVG painter (`drawDensity`'s `rampLut` arm) indexes it, and viridis
  itself moved to `@jbrowse/core/util/colorRamp` as `VIRIDIS_STOPS` so HiC's
  scheme and density's are one 256-stop table (HiC's pinned ramp bytes
  unchanged).
- **HiC and LD: behavior unchanged.** Their fragments compile from the module
  to the same math (`hicShaderParity.test.ts`, `colorRamp.test.ts`'s pinned
  ramp bytes, `ldColorRamp.test.ts`, both renderer suites — all green
  untouched); LD's explicit clamp moved into the module, where HiC's
  `mapHicCount` already clamps, so both double-clamp harmlessly rather than
  differently.
- **Kill condition: clear.** The helper's three parameters are `hal`, the
  bytes, and the pass list, each exercised by all three callers (the list with
  more than one entry by LD); no scheme registry, no per-display flag, no
  parameter only one caller passes. The scales stayed three, as rescoped:
  `mapHicCount`, LD's remap-plus-sentinel and `scoreScale` are untouched.

One seam deliberately left: the density legend (`scoreRamp`) still describes
the default white→track-colour fade, so a track configured with a named ramp
plots viridis under a legend drawn for the default. Legend work is UI and out
of this step's scope; the getter to extend is `scoreRampApplies`/`scoreRamp`
in `wiggleDisplayViews.ts`.

### Step 4 — `point` as the second shape

`pointGlyph.slang` is in render-core with one consumer (Manhattan's disc), and
the dotplot draws points too. Ordered after the ramp work because a second shape
is worth less than a second cardinality: cardinality is the axis that multiplies
the shape list if it is got wrong.

**Gate E: the dotplot's shader must actually shrink.** If it does not, the
library has one shape, which is a fine answer — ADR-090's surviving clause is
that a shape joins on a consumer's pull, not on completeness.

**Stopped 2026-08-28 — Gate E measured at the census, before a line moved: the
dotplot has no point drawing to put on the shape, and `point` already has the
two consumers this step set out to earn it.** Both premises above were stale:

- **"One consumer (Manhattan's disc)" undercounts.** `wiggle.slang`'s scatter
  arm is a second full shader consumer — `discExpand`, `discAlpha`,
  `crispSquareCornerClip` and `SMALL_POINT_MAX_DIAMETER`, the same inventory
  Manhattan pulls — and `wiggleLine.slang` imports `AA_PAD_PX` for its capsule
  pad. The CPU twin the `js-export` feeds (`pointMarker.ts` in wiggle-core)
  serves the gwas Canvas2D renderer and wiggle's draw functions. By Step 2's
  own standard `point` was already the library's second shape before this plan
  was written; what stays per-consumer already stays — Manhattan keeps
  `scoreToYPx` and its bin-bar branch, scatter keeps its midpoint anchor and
  row transform, and each hand-rolls only its own quad placement around the
  shared expansion factor.
- **The dotplot draws capsules, not point glyphs.** Every `dotplot.slang`
  instance is a segment (x1,y1)–(x2,y2) expanded along its tangent/normal
  frame by `halfWidth + aaHalfPx(dpr)`; the fragment's capsule SDF (`clamp`
  along the segment, then `length`) collapses to a disc of radius
  `lineWidth/2` when the segment degenerates, and that degenerate case is the
  only point the display has. Canvas2D parity is `lineCap: 'round'` strokes
  (`drawDotplot.ts:45`) — no arc, no square, no snap, on any backend.

Nothing in `pointGlyph`'s inventory transfers without changing drawn output,
which a factoring step forbids:

- `discExpand` scales a normalized local frame (disc boundary at distance 1)
  multiplicatively; the dotplot expands additively in true CSS px and has no
  normalized frame to scale.
- `discAlpha` measures its ramp with a derivative (`glyphEdgeAlpha`); the
  dotplot's AA is analytic on purpose — its distance comes off a `clamp`, so a
  derivative straddles the cap/body discontinuity — and its fragment comment
  says exactly that.
- The crisp-square fallback pixel-snaps points at or under
  `SMALL_POINT_MAX_DIAMETER`; a dotplot dot tracks sub-pixel pans through the
  `panPx` uniforms and matches a round-cap stroke, so snapping is a visible
  change on both counts.
- Routing the degenerate case through `discCoverage` needs a per-instance
  disc-vs-capsule branch: a rendering seam between a 0-length and a 1-px
  alignment, and WGSL rejects the derivative AA under a branch on a varying.

The gate results:

- **Gate E: fail, stopped.** Zero lines move: `dotplot.slang` 156 lines (75
  non-comment) before and after, `pointGlyph.slang` 88 (33), `manhattan.slang`
  190 (110) and `wiggle.slang` 183 (93) untouched. The library keeps the
  shapes it has — `rowRect`, `pointGlyph`, `diagonalGrid` — so the answer is
  one better than the gate's fallback: the manuscript's Step 4 row is already
  true of the tree, two shapes plus ADR-090's surviving admission clause,
  with no landing owed.
- **Kill condition: moot.** No shared function was created to grow a
  parameter.

One measured fact rides beside the stop: the shape the dotplot does share is
the capsule, and the tree already says so — `wiggleLine.slang`'s linecenter
fragment calls its AA "exactly as the dotplot capsule — the same shape, and
the same reason". The two still differ in frame (start-anchored `0..segLen`
against center-anchored `±segHalfLen`), pad (`aaHalfPx(dpr)` against
`AA_PAD_PX`) and blend role (a plot-wide alpha uniform against the max-blend
join union), so a `capsule` module is its own census and its own gates, not a
substitution this step could make in passing.

## What this is not

**Not the factory.**
[ADR-089](../architecture-decision-records/adr-089-a-track-type-is-a-spec-the-factory-composes-the-stack.md),
ADR-090 and ADR-091 are about an authoring surface: a display handed to
`defineDisplay` as a spec. Nothing here registers a display, composes an MST
chain, holds a config slot or crosses an RPC boundary. ADR-091's reopening
condition — hold alignments' `colorBy`, or Manhattan's LD model and dual-rename
RPC, without an `extend`, and stay lazy — governs a replacement for the display
stack. A shape library holds none of those things.

The eager-closure finding does not reach it either, and the reason is
structural, not a discipline. ADR-091's closure is about what a *registration*
names by value: the factory named the `bar` shader, so plugin install loaded
it. A shape module is composed at compile time — `slangc` inlines `import
rowRect` at `pnpm gen:shaders`, so `maf.generated.ts` carries no runtime import
of render-core's shader modules at all. A composed shape adds zero runtime
module edges and zero registration bytes, which clears the eager-bundle
constraint even for a consumer that registers eagerly. Both consumers happen to
be lazy anyway (`maf/LinearMafDisplay/index.ts:10` and
`canvas/LinearMultiRowFeatureDisplay/index.ts:10` are both `lazy(`), but
nothing depends on that.

ADR-090 was reverted because the factory it rode on was, and the port that
decided ADR-091 drew with Manhattan's own hand-written shader — the mark
system's only role in that experiment was as eager bytes in ADR-091's closure
table. The mark thesis was never tested. This plan tests the half of it that has
consumers.

**Not a transpiled draw stage.**
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
stands. A composed shape is hand-written Slang that imports two hand-written
modules, which is what `maf.slang` and `multiRow.slang` already are.

**Not a layout abstraction.** The boundary the grammar comparison settles on is
that placement, tiering and the fetch stay imperative and per-display. Both
vendored grammars have a declarative pileup (genome-spy's `transforms/pileup.js`
is 126 lines; gosling's `displace: pile`), and this tree's is `sortLayout.ts`
plus `layout.ts` because it is stateful across frames (`seedRowsFrom`,
`groupUnchanged`) and re-entrant against a height solve (`createPackProbe`).
Nothing in this plan touches either file. See
[reference/SESSION_SPEC_FORMAT.md](../reference/SESSION_SPEC_FORMAT.md)
§"The assessment".

**Not hit-test derivation.**
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) owns
that question, and its `features/mark.ts` reads pileup row geometry, which puts
it below the layout boundary this plan stays above. The two converge only if a
mark takes its row band as an argument rather than reaching into layout — an
open question there, not a dependency here.

## What each step lets the manuscript claim

| Step | The claim it earns |
| --- | --- |
| 1 | encodings are orthogonal to shapes — stated over five shaders, not one |
| 2 | a shape and a scale compose, and the composition keeps a pan at one uniform write |
| 3 | one ramp mechanism across quantitative, contact-matrix and LD colouring, each keeping its own scale |
| 4 | a shape library with two shapes and a stated admission rule |

Step 2's row is the one that distinguishes a shape library from a bag of
shaders. Do not write the grammar claim against Step 1 alone: a rule describing
five shaders is a census, not a mechanism.

## Ground this changes

- **ADR-090's colour ruling**, which is already inert (rejected with ADR-091) but
  reads as live to anyone who opens the file. Step 1's ADR should name it and say
  what replaces it.
- **ADR-040** is *not* overturned. It declined a shared quad helper on a
  two-consumer bar and said a third-party ergonomics argument would be "a
  different justification". This plan makes neither argument: it consolidates a
  cardinality that five shaders already implement, and Gate A is a measurement
  ADR-040 never had available.
- **`reference/SESSION_SPEC_FORMAT.md`** decided the grammar question for the
  *spec a reader writes* and for the authoring surface, both negative. This plan
  is the third place the question lands — below the display, where the answer
  differs — and that doc should point here so the three are not read as one.
