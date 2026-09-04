---
status: Accepted
summary: "Generate the Canvas2D twin of a shader's scalar decision functions from slangc's WGSL; never transpile the vertex or fragment stage"
---

> **Amended 2026-08.** Three changes, all recorded in place below: the subset
> gained `float2` **in return position only** (the "genuinely vector-valued
> decision" this ADR held the door open for turned up — see §A vector signature),
> the export/decline state is now a **generated inventory** rather than a prose
> list (§What is exported today), and the emitter is checked against **slangc's
> own C++** rather than by reading diffs (§Consequences).

# ADR-051: Shader→JS codegen covers scalar decisions only, never a draw stage

## Status

Accepted (2026-08). Extends [ADR-005](adr-005-shader-codegen-slang.md) (Slang
codegen) with a third generated artifact, and settles the recurring "why don't
we just compile the shaders down to Canvas2D?" question in both directions —
what we now generate, and what we deliberately never will.

## Context

Every canvas-drawing display ships two renderers: a `.slang` shader and a
Canvas2D draw function, the latter load-bearing because SVG export runs it
(GPU_RENDERING.md §"Canvas2D is the floor").
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

The one amendment (2026-08) is `float2` **in return position**, emitted as a TS
`[number, number]`. It is not a step toward vector support and is bounded so
that it cannot become one: no vec2 parameters, locals, swizzles, indexing or
arithmetic, only a `vec2<f32>(a, b)` constructor as the whole of a `return`, and
`vec3`/`vec4` refused by name. Nothing in the signedness or integer-division
inference has to know it exists. §"A vector signature is usually a scalar
decision in a wrapper" says why this case is different from the ones that table
turned down.

The shape that would push on that bound is a predicate *taking* a pair ("does
this span overlap that one"). Nothing in the tree wants one, and if one turns up
the first move is still this ADR's: try splitting the scalar decision out, and
widen only if the decision genuinely is not scalar. Widening to *parameters*
drags in vector locals and swizzles — the general vector support this ADR calls
unproven — so it is a much larger amendment than return position was.

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
layout lived in `alignmentsUniforms.slang` and was lifted by `coverage.slang`
into `@jbrowse/alignments-core`. (That band has since moved to render-core's own
`coverageBand.slang`, a shared module whose `js-export-out` was free — so it
exports its own. The mechanism stands; reach for it when the owning module's one
redirect is already spoken for.) Offered only to a shader with entry points,
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

**The current state is generated**, into
[reference/SHADER_LIFT_INVENTORY.md](../reference/SHADER_LIFT_INVENTORY.md): what
is exported, what is liftable and deliberately is not (with the reason, from a
`//! js-skip` beside the code), and what the emitter refuses and why. Read that
for *what*; the table below is kept for *what each export replaced*, which is
the part a scanner cannot know and the part that says whether the bar was met.

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
| `coverageBand.slang` | `covEffectiveHeightPx`, `covBottomOffsetPx`, `normalizeDepthScalar` | `@jbrowse/alignments-core` `coverageLayout` — the band's drawable height and baseline, which the coverage bars, SNP segments and modification segments all measure from, plus the depth normalizer `coverageNormalizeParity.test.ts` pins against `makeScoreNormalizer`. That last one is the band's name for `scoreScale.slang`'s `normalizeScore`, which is where the branches live |
| `wiggle.slang` | `RENDERING_TYPE_*` (5), `SCALE_TYPE_LOG`, `NO_PREV_START` via `export-consts` | `@jbrowse/wiggle-core` — the `renderingType` / `scaleType` uniform vocabulary and the instance-buffer sentinel, all re-typed by hand where `WiggleRenderingType` is declared |
| `manhattan.slang` | `GLYPH_POINT`, `GLYPH_INSERTION`, `GLYPH_INDEX` via `export-consts` | `ManhattanRPC/rpcTypes.ts` — restated there, and pinned to the shader only by a test that string-matched its branches out of the `.slang` source |
| `ldUniforms.slang` | `dprimeFinalize` | `@jbrowse/ld-core` `calculateDprime` — a line-for-line twin, and the only export so far where the two backends must agree on a **number the user reads** rather than on pixels |
| `ldUniforms.slang` | `ldRSquared`, `ldGenotypeD`, `ldGenotypeCorrelation`, `ldHaplotypeCorrelation` | `@jbrowse/ld-core` `calculateLDStats` + `calculateLDStatsPhased` — the rest of what `dprimeFinalize` left behind. Both compute kernels now end in these too, so the r/r²/D block is stated once instead of four times |
| `rect.slang` | `rectSpanPx` | `Canvas2DFeatureRenderer` `paintedRectSpan` — the point-vs-span branch, the pixel snap and the widening, all restated there; the first export whose answer is a pair |
| `chevron.slang` | `showChevrons`, `chevronCount`, `chevronOffset` | `Canvas2DFeatureRenderer` `drawLines` — the strand-marker layout, stated in bp in the shader and in px here, so the two copies did not even look alike |
| `chevron.slang` | `chevronFirstVisible`, `chevronLastVisible` | `drawLines` **and `vs_main`** — the first export to replace code on both sides, both of it inline, and the only one so far that fixed a live divergence rather than a latent one: the shader's window covered the chevron's arms and the Canvas2D one did not (see §The blind spot). Sharing it also made the GPU's window exact, which bought back 3 of the vertex slots `MAX_VISIBLE_CHEVRONS_PER_LINE` budgets |
| `continuation.slang` | `markerIsDark`, `markerHalfHeight`, `runsOffEdge` (+ `CONT_MARK_ALPHA` via `export-consts`) | `drawContinuation` **and `vs_main`** — the rest of what the marker decides, swept out in one pass rather than left for the next one to find. The luminance pick was stated in 0..1 against `> 0.5` on the GPU and in 0..255 against `> 127.5` here; the overhang gate was three comparisons in clip space against three hand-mirrored ones in px; the `0.4` height shrink and the `0.55` alpha were bare literals on both sides |
| `arrow.slang` | `arrowDraws` | `drawArrows`, and — the reason it is worth a function for one comparison — `strandArrowPadding` in **layout.ts**, which runs before either renderer and reserves the arrow's packing room. Three call sites in two processes, each measuring the width its own way on purpose, agreeing on the boundary by having written `14` down three times |
| `rect.slang` | `rectDrawsOutline` | `drawRects` `fs_main` — the "is this box big enough to inset a border" gate, a bare `2` on each side. Deliberately not `MIN_RECT_WIDTH_PX`, which is also 2 and answers a different question |
| `arc.slang` | `arcRadiiPx` | `features/arcs/drawCanvas.ts` `strokeArc` — the paired-read dome's two radii and the near/far branch behind them. The second export whose answer is a pair, and the second one whose copies did not look alike: the gate was `2*halfWidthPx > k*canvasW` in the shader and `\|sx2-sx1\| > k*screenWidthPx` here, taken as a `far` boolean the caller worked out |
| `ldUniforms.slang` | `ldEnoughGenotypes`, `ldEnoughGametes`, `ldLociPolymorphic`, `ldGenotypeAlleleFreq` | `@jbrowse/ld-core` + both compute kernels — the degenerate-input gates that stood between the moments and the already-generated estimators. The polymorphism test was written out in four places |

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

### The function that turned up: `rectSpanPx` (2026-08)

`rect.slang`'s `vs_main` decides where a feature rect's two screen-x edges land:
a degenerate span is an interbase **point** and straddles its coordinate, a real
span is snapped at both ends and then widened away from its start edge.
`paintedRectSpan` in `Canvas2DFeatureRenderer` was a hand-written twin of that
branch, and the two agreed only via an argument nobody had written down — the
shader's point branch does not widen, the Canvas2D one did, and that was
harmless only because `round(x + 1) - round(x - 1)` is exactly the min width.

It passes the test this section sets, where the earlier candidates did not:

- **The decision is the pair.** Splitting it into `leftEdgePx` and
  `rightEdgePx` makes each recompute the other's branch, and the right edge is
  defined in terms of the left one (`extendToMinWidthPx(left, …)`).
- **There is no packaging to leave behind.** `float4 → float4` candidates were
  refused because the vector part was a color conversion each backend should do
  its own way. Here both lanes are screen px on both backends; the only
  per-backend step is turning a signed edge pair into a `fillRect` x, which is
  `spanLeft`, already shared and deliberately not part of this.
- **The pair is the consumer's argument list.** It is the first and third
  argument of a rect fill. That is the honest limit of "generate canvas drawing
  commands": generate the geometry a mark occupies, and let each backend keep
  its own paint, style caching and culling.

This does not reopen the vertex stage. `vs_main` still describes triangles, and
the reasons in §"A vertex shader is not a geometry description" are unchanged —
what moved is that a px-space *mark extent* can now be factored out of one, the
same way a px-space scalar already could.

**Measured, because "the round trip is free" was an argument and not evidence.**
Rewriting the decision as px-in/px-out means `vs_main` now converts clip→px and
back, which on a per-vertex path deserved more than an algebra sketch. Both
formulations compiled to C++ (real float32, via the oracle's own path) and swept
over ~7.7k inputs — block widths 97..7680, sub-pixel offsets, spans either side
of the 2px floor, both orientations:

- **Cost: slightly lower.** 39 arithmetic operations reachable from `vs_main`,
  against 43 before, same function count and the same two conversions each way
  — `snapToPixelX` was already doing clip→px→clip internally, twice, so
  hoisting it out added nothing. Eliminating `pxToClipW` and the
  `* canvasWidth * 0.5` in the width readback paid for it.
- **Span branch: unchanged.** 0 of 7317 cases differ by as much as half a pixel
  (max 0.00024 px), and the min-width decision never flips.
- **Point branch: shifts a pixel** on 19 of 369 cases, mostly at exactly
  half-pixel offsets, because the old code formed the ±half-width as
  `2.0 / canvasWidth` in a normalized space and the perturbed value fell the
  other side of `floor(x + 0.5)`.

So the refactor is not quite behaviour-preserving. **That is a footnote, not a
result** — sub-pixel placement is best-effort between the backends, and a pixel
on a 2px interbase tick at a measure-zero input is exactly the class
ARCHITECTURE.md tells you not to chase. It is recorded so the next person to
diff the two formulations does not spend an afternoon on it.

The reusable part is the method, and one incidental fact: "px decision, thin
clip-space wrapper" is not only more liftable but slightly better conditioned,
since clip space is normalized by a division and pixel-scale arithmetic there
rounds where px-space arithmetic does not. Prefer the shape for the first
reason; the second is a bonus, not a justification.

### The second one: `arcRadiiPx` (2026-08-11)

A pair is no longer a sample of one. `arc.slang`'s dome takes its two ellipse
radii from a single branch — beyond `ARC_FAR_SCREEN_WIDTHS` of on-screen span the
ellipse becomes a true circle on the pair's own half-width, so the band clips the
apex away and only near-vertical legs remain — and `strokeArc` in
`features/arcs/drawCanvas.ts` restated it, taking the branch's answer as a `far`
boolean its caller computed.

It passes the same three tests, which is the point of recording it: the section
above could have been a one-off, and two instances agreeing on *why* is what
makes the shape reusable.

- **The decision is the pair.** `ry` is defined in terms of `rx` twice over —
  through the threshold, and as its own far-branch value — so two scalar exports
  would each recompute the other's branch.
- **No packaging to leave behind.** Both lanes are CSS px on both backends. The
  only per-backend step is choosing a sweep direction, which is Canvas2D's alone.
- **The pair is the consumer's argument list**, the adjacent `rx, ry` of
  `ctx.ellipse`.

It also repeats `rectSpanPx`'s *finding* rather than only its shape, and that is
the part worth generalizing. Both copies were stated in different terms from
their shader — bp against px for the chevrons, `2*halfWidth > k*canvasW` against
`|sx2-sx1| > k*screenWidthPx` here — so a "mirrors arc.slang" comment stays
true-looking while the arithmetic parts company. **Two spellings of one rule that
do not look alike is the signature to search for**, and it is the opposite of the
intuition, which is to go looking for copies that match. Unlike `scoreToYParity`
this one found no live bug; the retirement gate passed first run.

### The blind spot the survey had, and why two decisions were missed

`rectSpanPx` and the chevron layout (`showChevrons` / `chevronCount` /
`chevronOffset`) were both found in the same place, and it is a place no sweep
was looking: **inline in a `vs_main` body**. The codegen lifts functions and the
survey inventoried functions, so a decision that was never given a name was
invisible to both — while its Canvas2D twin was a perfectly ordinary hand-written
copy. Chevron spacing had been stated twice, in bp on the GPU and px on the CPU,
which is why comment-syncing it had held: the two copies do not even look alike.

The generated inventory does not close this — it also lists functions. What
closes it is the habit: when a `vs_main` body grows a decision, name it.

**The habit was not enough, and the third miss says why (2026-08-18).** The
chevron lift above named three decisions and left a fourth — the visible-index
window — inline in `vs_main`, because three were what it needed. `drawLines` had
its own copy, and the two disagreed: the shader's padded a whole slot at each end
and so happened to cover the chevron's arms, while the Canvas2D copy windowed on
the centre, so a chevron straddling a canvas edge drew on a GPU machine and
vanished on the no-GPU path and in every SVG export.

The residue is worse than an untouched `vs_main`, because a partly-factored one
*looks* finished: `chevron.slang` had a `//! js-export` line, three public
functions with the unit-agnosticism spelled out, and a parity test named
`chevronLayoutParity` sitting beside the untested window. Nothing in the
inventory, the export list or the test file said the shader still had an
unshared decision in it.

So the habit is not "name a decision when you add one", it is **"when you lift a
decision out of an entry point, lift every decision that entry point makes"** —
the ones you do not need included, since it is the neighbour left behind that the
next reader will take for already-shared. `chevronFirstVisible` /
`chevronLastVisible` are the fourth, and `vs_main` now makes no scalar decision
of its own.

Applied to the rest of `plugins/canvas`'s entry points in the same pass, which is
what the rule asks for: `continuation.slang`'s luminance pick, height shrink and
overhang gate; `arrow.slang`'s width gate; `rect.slang`'s outline-room test. None
of those had drifted — they are in the table above because the one that had gave
no sign, and a partly-lifted shader is where that happens.

The emitter got a fix out of it too, and by the route this section is about: the
oracle sweeps a function's whole domain, so naming the chevron window made it
probe a zero spacing, whose `0/0` reached `max(0.0, NaN)` — where the twin
answered NaN and slangc's C++ answers 0. `_max`/`_min` had been written as
`a > b ? a : b`, which is NaN-faithful in first argument position only, and every
existing test put the NaN on the left. Inline arithmetic is invisible to the
oracle as well as to the inventory: it referees *exports*, so lifting a decision
is also what gets it checked.

#### The sweep across the other display types (2026-08-18)

Run once, so it does not get run again from scratch. Two findings, both the same
shape as the chevron one — a decision whose neighbour had a name and it did not:

- **`rowRect.slang`'s horizontal min-width floor.** A bare `1.0` in
  `rowRectVertex` and a bare `1` in the multi-row painter, beside a *vertical*
  twin that has carried `MIN_DRAWN_ROW_PX` and an `export-consts` since it was
  written — whose comment calls itself "vertical twin of the min-width floor
  used below", naming a number nothing named. Both GPU renderers drawing this
  primitive spend a paragraph on which unit they measure it in. Now
  `MIN_DRAWN_CELL_PX`.
- **`variant.slang`'s glyph vocabulary.** The one enum still owned by
  TypeScript: `SHAPE_RECT`/`SHAPE_TRI_LEFT` declared in `variantShape.ts` under
  "Keep in sync there", with `fs_main` testing a bare `0u`. `manhattan` owns
  `GLYPH_*`, `wiggle` owns `RENDERING_TYPE_*`, `syntenyTypes` owns its `KIND_*`
  boundary; this now reads the same way.

What came back clean, which is most of it and is the point of writing this down:
`multiRow.slang` (a five-line wrapper over `rowRect`), wiggle's scatter
square/disc split (shared through `pointGlyph` and pinned by
`pointMarkerParity.test.ts`), `clip.slang`'s frequency fade (routes through the
exported `frequencyAlpha`), `insertion.slang`'s serif caps (constants generated;
the wedge itself is draw-stage), `snpCoverage.slang`'s `snpColor` (a `float3`,
so already an inventory refusal), and the variant cell span (already through
`snapVariantCellX`). Of the `SYNC:` markers, 27 at this ADR's writing, **six
remain across six files**: three sit in tests that pin the sync, one is
`syntenyTypes.slang` pointing at its own such test, and the two left in source
name divergences the inventory already refuses — `computeCorners` (`type
'Instance'`) and the dotplot renderer's `panPx` reconstruction.

Two greps did the finding, and either is worth re-running after a shader lands:
`SYNC:` across the tree, and — for the undeclared ones, which is what the
chevron case was — TypeScript files whose comments claim to mirror a `.slang`
while importing nothing from that shader's generated twin or consts. Neither is
a checker. A comparison inside a `vs_main` is legitimate about as often as it is
a missed lift (vertex-id dispatch, culling), so a gate on it would be noise; the
greps are for a human to read, which is why this section records the answer
rather than adding a job.

### Deliberately not exported

**This list now lives in the code**, as `//! js-skip: <fn> — <why not>` on the
`.slang` that authors the function, and is rendered into the generated
inventory's Declined table. Every entry is checked on each build: a skip naming
a function the emitter can no longer see, or one that is exported after all,
fails `pnpm gen:shaders`.

That check exists because of the `textWidth` entry below — this section asserted
"no counterpart exists" about a function whose counterpart had been sitting in
`labelConstants.ts` all along, and nothing said so. A prose list of things that
are *absent* has no way to notice when it stops being true.

The reasoning is kept here because it is the standard the skips are written
against; the skips themselves are the current state. Being already-scalar is
necessary, not sufficient — there has to be a consumer, and the two
implementations have to be *meant* to agree:

- **`discExpand` (pointGlyph)** — expands a quad so a fragment AA ramp isn't
  clipped. Canvas2D draws `ctx.arc` and has no quad; there is nothing to share.
- **`scoreToY` (wiggle)** — the normalizer moved out to
  `render-core/src/shaders/scoreScale.slang`, where the coverage band reads it
  too, and the degenerate (`min == max`) domain it used to diverge on now
  answers 0 on both sides. What is left of `scoreToY` once the normalizer is set
  aside is `(1 - norm) * h` — a multiply, in the `computeCorners` class — and
  the Canvas2D side composes the same normalizer with its own plot box.
  `densityGradientT` still takes *normalized* scores, which is the right split
  whether or not the two normalizers agree.
- **`snpColor` / `baseColor` (snpCoverage, mismatch)** — a `switch` from a base
  code to a `float3` out of `Uniforms`. The Canvas2D twins (`snpColorForType`,
  `buildBaseCssMap`) switch over the same codes, but what each returns is a
  color *object* / prebuilt CSS string versus three floats. This is the
  `hueRampHalfSat` shape from the table above: the dispatch is shared and
  trivial, the payload is per-backend, and a wrapper would be a hand-written
  twin again.
- **The coverage band's drawable height and baseline** (`effHeight` /
  `covBottom` as `alignmentsUniforms.slang` spelled them; neither name survives)
  — **now exported**, as `covEffectiveHeightPx` / `covBottomOffsetPx`. The blocker was destination, not
  shape: `alignmentsUniforms.slang`'s twin lands in plugin-alignments, which
  `@jbrowse/alignments-core` cannot import. Letting `coverage.slang` export a
  function it imports solved that without a new module, and is the general fix
  for "authored in the shared module, needed in a specific package". The band
  later moved into render-core's `coverageBand.slang` (two plugins draw it now),
  which redirects its own exports there instead — the general fix is still the
  one to reach for when the owning module's redirect is taken.
- **`sBlend` / `yCurve` (synteny)** — exported as a **test oracle**, not as
  production code. The Canvas2D path deliberately draws one `bezierCurveTo`
  rather than tessellating, and `syntenyRibbonPath.ts` carries an algebraic proof
  that the two are identical. `syntenyShaderParity.test.ts` checks that algebra
  numerically instead of trusting the comment. The bezier is the better
  implementation; sharing the formula would make it worse.

  A test oracle is still an export, and for a while this one wasn't: the test
  re-spelled both functions locally under a "syntenyTypes.slang, verbatim"
  comment, so the test that exists to catch twins carried one, and a sign slip in
  the copy would have made it pass against a shader drawing something else. It
  now imports the generated pair and reads the control points `buildFeaturePath`
  actually emits rather than a restatement of them.
- **`getGeno`, `getWord`** — no Canvas2D counterpart exists.

`textWidth` was on that list and should not have been: `textWidthForNumber` in
`labelConstants.ts` was its counterpart all along, mirroring the digit-count
branching over two exported constants, and the emitter had been transliterating
`textWidth` for some time already — as a private helper inside
`insertionWidth.generated.ts`, because `insertionBarWidthPx` calls it. Naming it
in `js-export` made that helper public and `labelConstants.ts` a one-line
re-export. The lesson is about the list, not the function: "no counterpart
exists" is a claim to re-check, not a category to file things in.

## Consequences

- **What is generated today, by count rather than by tally.** 24 shaders export
  something: **31 functions** (17 shaders carry `js-export`) and **86
  constants**. **19 of those names land in a different package than the shader**
  — 4 functions and 15 constants, via `js-export-out` / `consts-out`.
  `SYNC:`-tagged sites dropped by roughly two thirds, and six of the ones
  removed were **stale** — they named `read.slang` branches deleted when read
  classification moved to the CPU. Everything left falls under "Deliberately not
  exported" below; count the survivors with
  `grep -rn 'SYNC:' --include='*.ts' packages plugins products` rather than
  carrying a number here, for the same reason as the counts above.

  These are counts of what the directives currently emit, deliberately replacing
  a running "drift sites retired" tally that had been incremented by hand each
  round and drifted badly — it had reached "forty-five retired (twenty-eight
  functions and nineteen constants)" against a true 31 and 86, having been
  internally inconsistent from the start (its own "twenty-nine more" did not
  equal its "twenty-two functions and nine constants"). Recount rather than
  increment:

  ```sh
  grep -rh '^//! js-export:' --include='*.slang' packages plugins \
    | sed 's#^//! js-export: ##' | tr ',' '\n' | grep -c '[a-zA-Z]'
  grep -rh '^//! export-consts:' --include='*.slang' packages plugins \
    | sed 's#^//! export-consts: ##' | tr ',' '\n' | grep -c '[a-zA-Z]'
  ```
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
  before. `SLANG_VERSION` is pinned and the failure is loud.

  **The oracle for that is now generated rather than written** (2026-08).
  slangc emits C++ for the same Slang, so `pnpm check-shader-oracle` compiles
  every `js-export` set to C++, sweeps ~400 argument tuples per function over
  pools of exactly-float32-representable values, and compares against the
  generated twin — ~19,600 comparisons across 20 shaders, in seconds, in CI.
  The previous procedure was "read the generated diff and run the parity
  suite", and the parity suite covers the emitter only where somebody wrote a
  fixture: a desugaring change invalidates every twin at once, which is exactly
  the case a per-function test set is worst at.

  The retired twins stay, and are now the complementary check rather than the
  only one: they pin behavior a human decided was right — a degenerate
  y-domain, a reversed-block anchor — at inputs a random sweep would rarely
  reach. The oracle pins that the transliteration is faithful. It was verified
  by seeding a mistranslation (`Math.round` for `floor(x + 0.5)`, `Math.trunc`
  for the other edge) and confirming it failed with the offending inputs; a
  check that has never been seen to fail is not evidence.
- **An oracle that only checks what is exported checks the wrong half.** The
  first version swept the `js-export` set — the functions that already have a
  consumer, and often a hand-written parity test. Widening it to every function
  the emitter *can* emit (a fresh twin generated for the ones with no committed
  artifact) took ~28,000 comparisons instead of ~20,000 and found a real bug on
  its first run: `Math.min`/`Math.max` propagate NaN where slangc's
  `a > b ? a : b` drops it, so every twin that clamped disagreed with its shader
  on a NaN input. That is the drift `ldGenotypeCorrelation` guards by hand —
  "an unfilled cell on one backend and a clamped one on the other" — put back
  generically by the emitter's own helpers, in eight twins.

  The lesson generalizes past this codegen: **a differential check aimed only at
  the code someone already thought about is aimed at the tested half.**
- **The oracle's own first two failures were both in the harness, and both
  would have read as codegen bugs.** `0f` is not a valid C++ float literal, and
  `printf("%g")` spells infinity `inf`, which `Number()` parses as NaN — so
  every division by a swept zero was reported as C++ NaN against JS Infinity.
  A differential check is two implementations *and* a comparator, and the
  comparator is the one nothing else is checking.
- **"Every gap is a hard error" is a claim to keep auditing, not a property the
  design confers.** A review found two constructs that were silently
  mistranslated rather than refused, both now fixed and covered: integer `/`,
  which WGSL truncates and JS does not (`vid / 6u` → 1 on the GPU, 1.166… in
  the twin — wrong for ordinary inputs, and `insertion.slang`'s `vs_main`
  contains exactly that expression), and the literal suffix strip, which turned
  `0xff` into `0xf` because a hex literal's digits can end in `f`. Neither was
  reachable from a function exported today, which is *why* they survived: the
  refusal machinery is only tested where an export happens to go. The
  signedness work is the model — it was built because `showChevron` needed it,
  not because a sweep found it — so the standing job is to look for the next
  such construct before an export reaches it, rather than after.
- **A default type defeats a refusal, because a refusal can only fire on
  "unknown".** The next sweep found the integer-`/` fix reachable *around*: an
  un-annotated `let` was TYPED as `f32` on the reasoning that slangc annotates
  every `var` and leaves only float temporaries bare. That is a fabricated
  answer where the emitter's whole safety story is phrased as "I could not
  infer", so `let t = a + 1u; t / 2u` satisfied `divideIsIntegral` and emitted a
  float divide — 2 on the GPU, 2.5 in the twin. The fix is to infer the type
  from the initializer, as WGSL itself does, and leave it genuinely unknown when
  that fails; the existing twins are byte-identical afterwards, because every
  bare `let` in them really was float. **Look for other places a plausible
  default stands where an absence should.**
- **Unsigned subtraction underflows at ordinary values**, which is what
  separates it from the `+`/`*` overflow the emitter had documented as needing
  2^32-scale inputs and therefore left alone. `1u - 2u` is 4294967295 on the GPU
  and -1 unwrapped. `+` and `-` now re-wrap exactly through JS's coercions
  (`>>> 0` / `| 0`); `*` cannot be fixed that way — the true product reaches
  2^64 and loses its low bits in float64 before a mask could see them — so it
  goes through `Math.imul`, which is the exact 32-bit multiply and settles the
  case the old note called unmodelable.
- **Two smaller guards, both loud rather than clever.** A local whose name
  collides with an emitted helper (`let _clamp = _clamp(x, 0, 1)`) now throws
  instead of emitting a TDZ error, and one name declared twice with different
  types in sibling branches throws instead of the flat scope silently keeping
  the later one. Neither occurs today; both would have been silent.
- **slangc's scratch locals are renumbered per function.** `_S1`, `_S4`, `_S7`
  in the committed twins are positions in a counter slangc keeps across the
  whole module, so adding an unrelated function to a `.slang` — or to a module
  it imports — renumbers them in every twin lifted from it, and the generated
  diff then shows changes in functions nobody touched. They are emitted as
  `_t0`, `_t1`, … in first-declaration order instead.
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
- **A compute shader with a CPU fallback is the highest-stakes case, and it was
  found last.** Everything else here keeps two *renderers* agreeing. `ldCompute`
  is a WebGPU compute pass whose fallback is not a GLSL variant but the CPU path
  in `ld-core` — selected by GPU availability and by a work threshold below
  which dispatch overhead dominates — so a drift there is two users reading
  different r²/D' off the same data. Look for a `[shader("compute")]` with a
  hand-written CPU twin before looking at draw paths again.

  Following that up finished the job: only `dprimeFinalize` had been lifted,
  while r, r² and D — the metric the display actually defaults to — were still
  stated in all four places (two kernels, two CPU functions). They are
  `ldRSquared` / `ldGenotypeD` / `ldGenotypeCorrelation` /
  `ldHaplotypeCorrelation` now. **The lesson is that lifting one function out of
  a block is not the same as lifting the block**: `dprimeFinalize` was the
  hardest-looking piece, so extracting it read as done, and what stayed behind
  was the arithmetic simple enough that nobody expected it to drift — which is
  also the arithmetic nobody would notice drifting.

  What stays per-side is the accumulation loop, correctly: the kernel walks a
  packed genotype buffer through `getGeno`, the CPU walks an `Int8Array` of
  dosages. Those two loops produce the same six moments, and the split falls
  exactly where the ADR's "factor the scalar decision out of the conversion"
  rule puts it.
- **The per-call cost is real and immaterial; measure before optimizing it
  away.** Replacing `getDensityColor`'s hoisted reciprocal with a call to the
  generated `densityGradientT` costs **0.56 ns per feature** (1.22× on that
  arithmetic alone, 2M-feature microbenchmark) because the divisor can no longer
  be lifted out of the loop. Against a `ctx.fillRect` per feature it is noise.
  The place this *would* matter is already carved out: ADR's rule against
  converting `computeCorners`, four calls per instance at 500k instances.
- **That change also moved the CPU *toward* the GPU numerically.** `x * (1/d)`
  and `x / d` differ in the last ulp, and the shader divides — so the hoisted
  reciprocal was not merely faster but slightly different, putting roughly 1 in
  1000 features one 1/255 LUT bucket off. Same class as the synteny rounding
  note above: hoisting a reciprocal is a numeric choice, not just a speed one.
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
