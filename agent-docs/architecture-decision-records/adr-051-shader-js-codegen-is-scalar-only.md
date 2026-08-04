---
status: Accepted
summary: "Generate the Canvas2D twin of a shader's scalar decision functions from slangc's WGSL; never transpile the vertex or fragment stage"
---

# ADR-051: Shader→JS codegen covers scalar decisions only, never a draw stage

## Status

Accepted (2026-08). Extends [ADR-005](adr-005-shader-codegen-slang.md) (Slang
codegen) with a third generated artifact, and settles the recurring "why don't
we just compile the shaders down to Canvas2D?" question in both directions —
what we now generate, and what we deliberately never will.

## Context

Every canvas-drawing display ships two renderers: a `.slang` shader and a
Canvas2D draw function, the latter load-bearing because SVG export runs it
(ARCHITECTURE.md, "Canvas2D is the floor; GPU is the optional accelerator").
Parity between them is kept by construction where possible — `//! export-consts`
puts a constant in the shader and generates the TS — and by hand-written twins
where not. There were **27** `SYNC:`-tagged hand-sync sites when this was
written, and several outright hand-ports: `Canvas2DFeatureRenderer`'s
`boxHeightPx` / `boxCenterY` carried comments reading "JS twin of hpmath.slang's
`snapBoxHeightPx`".

The obvious fix — cross-compile the shader — was investigated and is mostly a
trap. What follows is the evidence, because the idea returns about once a
quarter.

### Slang's CPU targets do not support graphics stages

`slangc` lists `c` / `cpp` / `host-cpp`, which reads like "add a flag, get a CPU
renderer". It is not:

```
# -target c, vertex entry:
error[E36107]: entrypoint 'vs_main' uses features that are not available
in 'vertex' stage for 'c' compilation target
  note: see using of 'max'  --> hpmath.slang:23

# -target cpp, same entry:
exit=139        # segfault, no output
```

The same file compiles cleanly to `cpp` **and** `spirv` when the entry point is
`[shader("compute")]`. The gate is the stage, not the math — which is why the
generator synthesizes a compute wrapper (below).

### A vertex shader is not a geometry description

This is the load-bearing finding. `vs_main` describes how to emit triangles for
a GPU, not where a mark is. `chevron.slang` is the proof: a 12-vertex `switch`
over `SV_VertexID`, `aaPad` / `extHalfThickness` extrusion existing only to feed
the fragment stage's `fwidth` antialiasing, an `OFFSCREEN` sentinel for
culling, and a `dist` varying. Transliterating it yields AA-padded clip-space
triangles that a Canvas2D consumer would have to *undo* to recover the
three-point polyline `ctx.stroke()` wants. The generated output would be worse
than the ~20-line hand loop in `drawLines`.

Three more reasons the draw stages stay out of scope:

- **SVG export needs vector output.** A per-fragment interpreter emits pixels,
  turning every export into an embedded PNG.
- **The backends diverge on purpose.** `WIGGLE_FUDGE_FACTOR`, the variant-matrix
  `f2`, synteny's sub-pixel centerline stroke are per-backend AA compensation
  that ARCHITECTURE.md instructs *not* to port into a `.slang`. A faithful
  transpiler deletes them.
- **Perf runs backwards.** The Canvas2D path exists partly for the no-GPU case,
  i.e. the weakest machines. It is hand-tuned in ways a transpiler will not
  reproduce (`rectFillStyle`'s fillStyle run-cache, `pileupRowOffCanvas`
  culling, `drawContinuation`'s whole-scan skip, the chevron on-screen window).

### What *is* worth generating

Between the shader's triangle emission and the Canvas2D loop sits a thin layer
of **pure scalar decisions** that both backends must make identically: which
pixel row a glyph centers on, how a sub-pixel span is widened, how an alpha
fades. That layer is small, has no coordinate-space or rasterization content,
and is exactly where the hand-ports were.

## Decision

Add a `//! js-export: fnA, fnB` directive. `pnpm gen:shaders` emits
`<base>.js.generated.ts` containing TypeScript twins of the named functions.

**WGSL is the intermediate representation.** By the time slangc emits it,
generics are monomorphized, overloads resolved, `&&` expanded into explicit
branches, `?:` lowered to if/else, and conversions made explicit — every
question a hand-rolled `.slang` parser would have to answer itself, already
settled. Crucially it stays *structured*: real `if`/`else`/`return` and named
locals, so `wgslToJs.ts` is a transliterator, not a compiler.

SPIR-V was the other candidate and gives the same post-analysis guarantee, but
arrives as SSA with `OpSelectionMerge`/phi — a single `?:` would need
control-flow reconstruction, and the output would be unreadable `_23 = _19 *
_21`. It also is not already in the pipeline; WGSL is. Revisit SPIR-V only if a
per-fragment test oracle is ever built, where a flat instruction stream is the
right shape.

**The subset is scalar-only and every gap is a hard error.** Vectors, swizzles,
indexing, loops, pointer params and unimplemented builtins all throw at
`pnpm gen:shaders`, naming the construct and the line. This is the central
safety property: a transliterator that silently guesses is strictly worse than
the hand-written twin it replaces, because the twin is at least reviewable.

Two mechanics follow from the findings above:

- **A synthesized compute wrapper, for module files only.** Slang eliminates
  code no entry point reaches, so asking for a module's WGSL directly yields
  nothing. The driver generates a throwaway `[shader("compute")]` entry calling
  each exported function, compiles that, and lifts the bodies. A shader that has
  its own entry points needs none of this — it already keeps the functions alive
  and cannot be `import`ed anyway, so the twin is lifted from the WGSL that
  shader's normal compile already produced.
- **Shaders factor the px-space decision out of the clip-space conversion.**
  `snapBoxCenterY` became `yPxToClipY(snapBoxCenterYPx(...))`;
  `extendToMinWidthX` became a unit conversion over `extendToMinWidthPx`. The
  shader API is unchanged, and the *decision* is now exportable. Any future
  shared decision should be authored in this shape.

Lifting from a whole shader means the WGSL also carries the vertex and fragment
support code — `vec4` math, `ptr<function, Uniforms>` params, texture samples.
Those functions are **parked with the reason they were refused** rather than
vetoing the file, and the reason is re-thrown the moment an export turns out to
name or call one. The hard-error property is unchanged where it matters: nothing
is emitted for a function that was not fully understood.

**Integer types are tracked, not just TypeScript ones.** `u32` and `i32` are
both `number` in TS but behave differently under the bitwise operators: JS
coerces to *signed* int32, so a `u32` at or above 2³¹ comes back negative and
`>>` shifts in sign bits rather than zeros. The emitter therefore carries the
WGSL type of every parameter, local and expression, emits `>>>` for an unsigned
shift and `(… ) >>> 0` after the other unsigned operators, and **refuses** where
it cannot infer signedness rather than picking one. That is what makes flag
words and packed colors — `(flags & 8u) != 0u`, `(packed >> 24u) & 255u` —
transliterable at all.

Two escape hatches mirror the ones `export-consts` already had:

- **`//! js-export-out: <path>`** writes the twin to a repo-relative path
  instead of beside the shader, for a Canvas2D consumer in a package that cannot
  depend on the shader's own. `insertionBarWidthPx` lands in
  `@jbrowse/alignments-core`, which plugin-alignments, plugin-maf, plugin-canvas
  and plugin-variants all read.
- **Imported `static const`s resolve.** The constant evaluator now reads the
  modules a shader `import`s, so a pass can write `CURVE_SEGMENTS * 6u` where it
  previously had to spell `48u` under a comment explaining that the codegen
  could not follow the identifier. It also reads **hex**, which it could not: a
  `u32` sentinel is spelled `0xffffffffu`, and the evaluator saw the leading `0`
  as the number and `xffffffffu` as an unresolvable identifier — so the one
  constant form a "larger than any real value" marker needs was the one form
  that could not be exported.

**A shader may also export a function it only `import`s**, which is what makes
those two compose. `js-export-out` redirects a whole file, so a decision
authored in a shared module could otherwise only land beside that module —
redirecting `alignmentsUniforms.slang` would drag `frequencyAlpha` and the arc
scale out of the plugin that owns them. Naming the function on the *pass* that
draws with it puts the twin wherever that pass wants, and leaves the decision
authored next to the clip-space conversions built on it: the coverage band's px
layout lives in `alignmentsUniforms.slang` and is lifted by `coverage.slang`
into `@jbrowse/alignments-core`. Offered only to a shader with entry points,
where the twin comes from that shader's own compile and the draw path is what
keeps the function alive. A module gets its own source only, because its export
path compiles a synthesized wrapper that `import`s exactly one module and Slang
does not re-export a grandparent's symbols — the error message says so rather
than letting the name vanish between the directive and the WGSL.

**Retirement is gated by a differential test.** The hand-written twin is kept
verbatim as a fixture, swept against the generated function over the inputs
where it historically broke, and only then deleted —
`hpmathParity.test.ts` is the pattern to copy. It needs no browser and no GPU,
which matters because `crossBackendGate.ts` requires a GPU and so cannot cover
the no-GPU path this all exists for.

## What is exported today

| Shader | Exported | Consumer, and what it replaced |
| --- | --- | --- |
| `hpmath.slang` | `snapBoxHeightPx`, `snapBoxCenterYPx`, `extendToMinWidthPx` | `Canvas2DFeatureRenderer` — two hand-ports (`boxHeightPx` / `boxCenterY`, both labelled "JS twin of…") and the open-coded `max(floor, \|dx\|)` |
| `alignmentsUniforms.slang` | `frequencyAlpha` | `rendererTypes.ts` — a copy under "Same formula as frequencyAlpha() in alignmentsUniforms.slang"; backs `frequencyFade`, which every fading pass routes through |
| `syntenyTypes.slang` | `isCigarKind`, `isMarkerKind` | `Canvas2DSyntenyRenderer` — `kind >= KIND_CIGAR_MATCH` and `kind === KIND_MARKER`, re-spelled inline |
| `pointGlyph.slang` | `crispSquareTopLeftPx` (+ `SMALL_POINT_MAX_DIAMETER` via `export-consts`) | `pointMarker.ts` — the `Math.floor(v + 0.5)` snap and a re-typed `3` |
| `alignmentsUniforms.slang` | `arcYFraction`, `arcYOffsetPx` | `arcYScale.ts` — a copy tagged "must stay byte-identical", feeding both the arc draw and the insert-size ruler ticks |
| `syntenyTypes.slang` | `fillShade`, `hoverDarken`, `thinWidthFade` | `Canvas2DSyntenyRenderer` — the ×5/0.35 hover boost, the 0.7 darkening, and the sub-pixel density fade with `WIDTH_FADE_FLOOR` re-typed as a local const |
| `hic.slang` | `mapHicCount` | `colorRamp.ts` — "Mirrors the logic in hic.slang's fragment shader"; first export lifted from an entry-point shader |
| `read.slang` | `insertGradientT` | `colorUtils.ts` — the insert-size gradient ramp, under a `SYNC:` on `IS_GRADIENT_SPAN_FRAC` |
| `insertion.slang` | `insertionBarWidthPx` (+ the four thresholds via `export-consts`) | `@jbrowse/alignments-core` `labelConstants.ts` — the insertion marker's width, read by two plugins' renderers and three hit tests |
| `read.slang` | `showChevron` | `features/read/drawCanvas.ts` — "Mirror of read.slang `showChev`"; the first export needing bit operations |
| `gap.slang` | `intronAlpha` | `rendererTypes.ts` — a hand-expanded smoothstep, under a "keep these in sync" comment on *each* side |
| `rowRect.slang` | `drawnRowHeightPx`, `rowBandOffsetPx` (+ `MIN_DRAWN_ROW_PX`) | `plugins/canvas` `rowBand.ts` — the row band the painter, the indel glyphs and the hover box all inset from |
| `variant.slang` | `drawnCellHeightPx` | `Canvas2DVariantRenderer` + `variantCellLookup` — `Math.max(rowHeight, 2)` twice, so a cell could paint taller than it picks |
| `manhattan.slang` | `INDEX_GLYPH_SCALE` via `export-consts` | `Canvas2DManhattanRenderer` — a re-typed `1.6`, previously guarded by a test that scraped the `.slang` with a regex |
| `variant.slang` | `snapCellEdgePx`, `snappedCellWidthPx` | `snapVariantCellX.ts` — the half-canvas-offset pixel snap, which is parity rather than an approximation to `Math.round` only because someone worked the clip-space algebra out by hand |
| `overlap.slang` | `overlapAlpha` | `features/overlap/drawCanvas.ts` — the constants were already shared; the `smoothstep` between them was hand-written |
| `continuation.slang` | `markerDirection`, `strandMatchesEdge` | `Canvas2DFeatureRenderer` — edge-marker sign arithmetic, "kept in agreement by eye" |
| `syntenyTypes.slang` | `KIND_CIGAR_MIN`, `KIND_MARKER` via `export-consts` | `syntenyColors.ts` — the CIGAR kinds now number themselves off the shader's boundary, so staying contiguous above it is structural |
| `mismatch.slang` | `qualityFade` | `features/mismatch/drawCanvas.ts` — "Mirrors the GPU mismatch.slang path"; the whole `mismatchAlpha` setting is this one three-way conditional, and it was stated twice |
| `wiggle.slang` | `densityGradientT` | `getDensityColor.ts` — the density ramp position, carrying a `max(maxDist, 0.0001)` floor that cannot fire, kept only so the two backends read identically |
| `manhattan.slang` | `scoreToYPx` | `manhattanRenderingBackendTypes.ts` — Manhattan's whole Y mapping, read by the Canvas2D draw *and* the hover hit test |
| `coverage.slang` | `covEffectiveHeightPx`, `covBottomOffsetPx` (authored in `alignmentsUniforms.slang`) | `@jbrowse/alignments-core` `coverageLayout` — the band's drawable height and baseline, which the coverage bars, SNP segments and modification segments all measure from |
| `wiggle.slang` | `RENDERING_TYPE_*` (5), `SCALE_TYPE_LOG`, `NO_PREV_START` via `export-consts` | `@jbrowse/wiggle-core` — the `renderingType` / `scaleType` uniform vocabulary and the instance-buffer sentinel, all re-typed by hand where `WiggleRenderingType` is declared |
| `manhattan.slang` | `GLYPH_POINT`, `GLYPH_INSERTION`, `GLYPH_INDEX` via `export-consts` | `ManhattanRPC/rpcTypes.ts` — restated there, and pinned to the shader only by a test that string-matched its branches out of the `.slang` source |

### A vector signature is usually a scalar decision in a wrapper

The first round of this work assumed vector support was the next unlock, because
the obvious remaining candidates all returned a `float3`/`float4`. Working
through them one at a time says otherwise. In every case examined so far, the
part the two backends must agree on was already scalar, and the vector part was
a **color-space or packaging conversion each backend should keep doing its own
way**:

| Candidate | Signature | What was actually shared |
| --- | --- | --- |
| synteny `shadeFill` | `float4 → float4` | `fillShade` + `hoverDarken`, two scalars; the blend around them is 0-1 floats on the GPU and 0-255 bytes inside an `rgba()` string on Canvas2D |
| read `insertSizeGradientColor` | `float3` | `insertGradientT`, the ramp position; the lerp is per-backend |
| hic's fragment `t` | inside `fs_main` | `mapHicCount`, already scalar, just not in a function |
| synteny `computeCorners` | struct in, struct out | `bpRel * bpPerPxInv + panPx` per corner — the struct is packaging |
| read `hueRampHalfSat` | `float3` | nothing: the JS twin emits `hsl(...)` and never has three channels |
| `unpackRGBA` | `u32 → float4` | nothing: `abgrRed/Green/Blue/Alpha` already exist in `@jbrowse/core/util`, are on the public ABI, and are correct |

So the recipe for a "needs vectors" function is the same one the shaders already
follow for clip space: **split the scalar decision out, export that, leave the
conversion**. It is also the better outcome — a verbatim vector lift would hand
the Canvas2D path a `float4` it has to unpack and requantize, and that adapter
code is itself a hand-written twin.

Vector support is therefore **not** blocked-and-valuable, it is unproven. Build
it when a function turns up whose *decision* is genuinely vector-valued, not
because a signature has a `3` in it.

### Deliberately not exported

Being already-scalar is necessary, not sufficient — there has to be a consumer,
and the two implementations have to be *meant* to agree:

- **`discExpand` (pointGlyph)** — expands a quad so a fragment AA ramp isn't
  clipped. Canvas2D draws `ctx.arc` and has no quad; there is nothing to share.
- **`normalizeScore` / `scoreToY` (wiggle)** — the shader's own comment records a
  deliberate divergence from JS `makeScoreNormalizer` on a degenerate
  (`min == max`) domain: JS returns 0, the shader avoids NaN. Unifying them is a
  product decision, not a codegen one. That divergence is also what fixes the
  split point for `densityGradientT`, which takes *normalized* scores: the ramp
  is the only part of the density branch both backends must agree on.
  `scoreToY`'s own remaining content, once the normalizer is set aside, is
  `(1 - norm) * h` — a multiply, in the `computeCorners` class.
- **`snpColor` / `baseColor` (snpCoverage, mismatch)** — a `switch` from a base
  code to a `float3` out of `Uniforms`. The Canvas2D twins (`snpColorForType`,
  `buildBaseCssMap`) switch over the same codes, but what each returns is a
  color *object* / prebuilt CSS string versus three floats. This is the
  `hueRampHalfSat` shape from the table above: the dispatch is shared and
  trivial, the payload is per-backend, and a wrapper would be a hand-written
  twin again.
- **`effHeight` / `covBottom` (coverage band)** — **now exported**, as
  `covEffectiveHeightPx` / `covBottomOffsetPx`. The blocker was destination, not
  shape: `alignmentsUniforms.slang`'s twin lands in plugin-alignments, which
  `@jbrowse/alignments-core` cannot import. Letting `coverage.slang` export a
  function it imports solved that without a new module, and is the general fix
  for "authored in the shared module, needed in a specific package".
- **`sBlend` / `yCurve` (synteny)** — exported as a **test oracle**, not as
  production code. The Canvas2D path deliberately draws one `bezierCurveTo`
  rather than tessellating, and `syntenyRibbonPath.ts` carries an algebraic proof
  that the two are identical. `syntenyShaderParity.test.ts` now checks that
  algebra numerically instead of trusting the comment. The bezier is the better
  implementation; sharing the formula would make it worse.
- **`textWidth`, `getGeno`, `getWord`** — no Canvas2D counterpart exists.

## Consequences

- Six drift sites retired in the first round, forty-four more since
  (twenty-seven functions and nineteen constants, fifteen of them crossing a
  package boundary); `SYNC:`-tagged sites went 27 → 9, and six of the ones removed were
  **stale** — they named `read.slang` branches deleted when read classification
  moved to the CPU. Everything left is classified in
  [handoffs/shader-js-codegen.md](../handoffs/shader-js-codegen.md).
- **Not every drift site wants codegen.** The last `SYNC:` tag that was not
  shader-coupled at all — `features/linkedReads/compute.ts` keeping its palette
  indices numbered like `PAIR_DIRECTION_NUM` — closed by defining one from the
  other. Two TS constants that must be equal should *be* equal; reach for a
  generated twin only when the other side is the shader.
- The `SYNC:` tags were never the whole inventory. Grepping TS for `.slang`
  turns up as many untagged "Mirrors X.slang" comments, and that is where
  `mapHicCount`, `intronAlpha`, `showChevron`, `rowBandPx`, `overlapAlpha` and
  the continuation sign arithmetic all came from.
- **`js-export` reaches every shader**, module or not. `//! js-export-out` puts
  the twin where a cross-package consumer can import it.
- Constants resolve through imports, so `VERTS_PER_INSTANCE` can be derived from
  the module constant that actually determines it.
- Generated JS is float64 where the shader is float32. This is not bit-exact and
  is not meant to be — CPU float64 is *more* accurate, the previous hand-written
  twins were also float64, and the backends already diverge deliberately. Parity
  tests assert behavior, not bit patterns.
- The emitter couples the build to the *shape* of slangc's WGSL output
  (identifier mangling, desugaring choices), which no consumer depended on
  before. `SLANG_VERSION` is pinned and the failure is loud, but a version bump
  should re-run `pnpm gen:shaders` and read the diff.
- Scope is deliberately capped: this covers scalar decisions, not the ~5,400
  lines of hand-written canvas drawing repo-wide. Roughly 1,200 of those lines
  have no shader counterpart at all (the Canvas2D-only sequence display, MAF's
  overlay painters, labels, SVG-export-only highlight boxes), and most of the
  rest is loop scaffolding and style caching rather than shader-mirrored math.
  Reducing canvas LOC generally is a *different* job: keep promoting recurring
  loop pieces into `canvas2dUtils.ts`, as `forEachClippedBlock` / `fillBpSpan` /
  `makeCellLeftMapper` already were.
- One consumer changed behavior rather than just its source: synteny's
  `resolveInstanceFill` now rounds to 8 bits instead of truncating with `| 0`.
  Truncation biased every channel down by up to a full unit where the GPU
  rounds, and it turned the generator's float32 constants (0.35 arrives as
  0.34999999403953552) into whole-step errors wherever a product landed on an
  exact integer. Any consumer taking a generated float into byte space should
  round for the same two reasons.
- **An enum shared with a uniform is `export-consts`'s best case, and was the
  last one left.** `wiggle.slang`'s five `RENDERING_TYPE_*` and its `scaleType`
  encoding were hand-typed on both sides: a renumbering reaching only one would
  have made the Canvas2D path draw a different *plot type* from the GPU, with
  nothing throwing. Manhattan's glyph ids were the same, and were "guarded" by a
  test that read the `.slang` and string-matched `inst.glyph == 1u ? SHAPE_TRI`
  — which pins the source text, breaks on reformatting, and could never have
  caught the two sides agreeing on a spelling while disagreeing on a number.
  Look for a TS constant whose value only means anything to a shader.
- **Generating a constant can delete a test rather than add one.** With one
  definition left there is no pair to compare, so the glyph contract test kept
  only what still has content: that the classes stay distinct, and that the
  classifier over them behaves. A test asserting two things agree is a sign the
  two things should be one thing.
- **A retirement gate found a live bug, which is the mechanism working.**
  Manhattan's JS `scoreToY` guarded a degenerate y-domain with `|| 1` where the
  shader used `max(range, 1e-6)`, and the shader's comment asserted the two
  matched. They do not: `|| 1` invents a phantom unit-wide domain, so with
  `minScore` and `maxScore` config-pinned to the same value, a score half a unit
  above the pin drew half-way up the Canvas2D canvas while the GPU clamped it to
  the top. Adopting the shader's behavior is the fix, and the Canvas2D path — the
  one `crossBackendGate` cannot reach — is where it had been wrong. When a
  parity sweep fails, check which side is right before making it pass; that is
  the whole reason the fixture is swept rather than eyeballed.
