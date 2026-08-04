---
name: shader-js-codegen
description: State of `//! js-export` — generating the Canvas2D/SVG twin of a shader's scalar decisions from slangc's WGSL. What is exported, what the survey of the remaining hand-sync sites found (including that vector support is not the unlock it looked like), and the residue. Read before adding an export or extending the emitter.
---

# Shader → JS codegen

The *why*, including everything deliberately not built, is
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
— read it first, this file assumes it.

## What exists

| Path | What |
| --- | --- |
| `packages/shader-tools/src/shader-codegen/wgslToJs.ts` | tokenizer + recursive-descent parser + emitter for the scalar subset of slangc's WGSL |
| `packages/shader-tools/src/shader-codegen/wgslToJs.test.ts` | weighted toward the *refusals* |
| `parseDirectives.ts` | `//! js-export:`, `//! js-export-out:`, and the constant evaluator (which resolves through `import`s) |
| `build-shaders.ts` `writeJsExports` | lifts from the shader's own WGSL, or from a synthesized compute wrapper for `module` files |
| `*.js.generated.ts` | the generated twins — never hand-edit |
| `hpmathParity` / `alphaShaderParity` / `syntenyShaderParity` / `pointMarkerParity` / `hicShaderParity` / `qualityFadeParity` / `densityGradientParity` / `scoreToYParity` / `coverageBandLayoutParity` / `dprimeFinalizeParity` / `insertionWidth` / `rowBand` / `drawCanvas` tests | the retirement gates |

Seventeen shaders export today; the table is in ADR-051.

**Generated constants have no re-export hops.** A consumer imports from the
generated module (or from the package that owns the concept, where a
`consts-out`/`js-export-out` put it) — never through a third module that merely
passes it along. Two chains that existed were removed while adding these; don't
add one back for convenience.

## Verified facts, do not re-derive

- **slangc's CPU targets do not support graphics stages.** `-target c` on a
  vertex entry errors (`'max' not available in 'vertex' stage`); `-target cpp`
  **segfaults** (exit 139). Both work on a `[shader("compute")]` entry. This is
  why module files get a synthesized compute wrapper.
- **Slang DCEs anything no entry point reaches.** For a module that means the
  wrapper is the only way to get WGSL at all. For a shader with entry points it
  means an exported function must be *called from the draw path* or it will not
  be in the output — the error message says so.
- **A whole shader's WGSL parses partially, on purpose.** Its stage support code
  (`vec4` math, `ptr<function, Uniforms>`, texture samples) is parked with the
  reason it was refused; the reason is re-thrown only if an export reaches it.
- **The regeneration touches ~85 `.generated.ts` files whenever a widely-imported
  `.slang` changes length, and the only delta is GLSL `#line` debug numbers.**
  Word-diff before assuming a semantic change.
- **Generated JS is float64, the shader is float32 — but the *literals* are
  float32.** `0.35` comes back as `0.34999999403953552`. Harmless in float space;
  it bites a consumer that truncates into byte space, which is why synteny's fill
  now rounds. Parity tests use `toBeCloseTo`, never bit equality.
- **Integer signedness is tracked and refused-on-doubt.** `u32` and `i32` are
  both `number` in TS, so the emitter carries the WGSL type: `>>>` for an
  unsigned shift, `>>> 0` after the other unsigned bitwise operators, and a hard
  error where it cannot infer which. Don't "simplify" that away — the values
  that need it (packed ABGR colors, flag words) are exactly the ones at or above
  2³¹ where JS's signed coercion silently changes the answer.
- **Factoring a decision into its own scalar function is free on the GPU and
  ~0.5ns/item on the CPU.** Slang keeps the function in the emitted WGSL (that
  is exactly what makes the lift possible) and every downstream compiler inlines
  a scalar leaf — there is no call stack on a GPU. The measurable cost is all on
  the consumer side, and only where the call defeats loop-invariant hoisting:
  `getDensityColor` lost a hoisted reciprocal and measured 1.22× on that
  arithmetic, 0.56 ns/feature. Don't pre-optimize this; do respect the existing
  carve-out for genuinely hot loops (`computeCorners`, 500k instances).
- **A shader can export a function it only `import`s** (entry-point shaders
  only — a module's synthesized wrapper cannot see past its own module, and the
  error says so). This is how a decision authored in a shared module reaches a
  package that module's plugin cannot write into, without a new `.slang` file
  existing only to own a `js-export-out`. Reach for it before concluding "the
  destination is wrong, so leave the twin hand-written" — that conclusion was
  drawn once and was wrong.
- **A retirement gate is a bug detector, not a formality.** `scoreToYParity`
  failed on its first run: Manhattan's JS and shader spelled the degenerate
  y-domain guard differently (`|| 1` vs `max(range, 1e-6)`) and the shader's own
  comment claimed they matched. They do not — see ADR-051's consequences. When a
  sweep fails, work out which side is right; do not adjust the fixture to agree.
- **A `bool` parameter survives the whole pipeline** and lands as a TS
  `boolean`, so a shader-side `u.someFlag != 0` should be lifted as
  `fn(x, bool enabled)` rather than an int — the consumer then passes its
  existing boolean. `qualityFade` is the first export doing this. Note slangc
  expands the `&&` in its body into an `if`/`else` over a `_S5` temporary, so
  the generated JS is longer than the Slang; that is the desugaring, not a bug.
- **A `SYNC:` tag can be stale.** Six in `colorUtils.ts` / `colorSchemes.ts` /
  `insertSizeStats.ts` named `read.slang` branches (`chainHasSupp`,
  `colorSuppChains`, `isOrientationScheme`, `insertSizeColor`) that were deleted
  when read classification moved to the CPU. Grep the counterpart before
  trusting a tag, and before counting one.
- **Not every mirror is worth converting.** `computeCorners` is `a*b+c`; the
  comments around it document a *convention*, and converting would cost four
  calls per instance in a 500k-instance loop. The test is whether a hand-written
  twin could plausibly drift *and* the difference would be hard to see —
  `snapCellEdgePx`'s half-canvas offset passes it, a multiply-add does not.

## The load-bearing finding

**A vector or struct signature is usually a scalar decision in a wrapper.** The
previous handoff called vector support "the big one". Working the candidates
one at a time found the opposite: in every case, the part both backends must
agree on was already scalar, and the vector part was a color-space or packaging
conversion each backend should keep doing its own way. The table is in ADR-051
§"A vector signature is usually a scalar decision in a wrapper".

So the recipe below is the job, and vector support is unproven rather than
blocked. Build it when a function turns up whose *decision* is genuinely
vector-valued.

The gap that **was** real turned out to be integer semantics, not vectors:
`showChevron` reads packed flag bits, and the emitter could not have
transliterated `(flags & 8u) != 0u` correctly without knowing signedness. That
is built now (see the type-tracking note above), and it is what the color
functions would have needed first anyway.

## Adding a function to the export set

1. Find the scalar decision. If the natural signature takes a `Uniforms` struct,
   returns clip space, or returns a color, **split it**: pure scalar core, thin
   wrapper the shader's own call sites keep using. `snapBoxCenterYPx` /
   `snapBoxCenterY` and `fillShade` / `shadeFill` are the pattern.
2. Add the name to `//! js-export:`. Cross-package consumer? Add
   `//! js-export-out: <repo-relative path>` — it redirects, so there is exactly
   one generated file. If the decision belongs in a shared *module* but the twin
   has to land somewhere that module's own package can't reach, put both
   directives on a **pass that imports it** instead: the name resolves through
   imports for a shader with entry points. `coverage.slang` exporting
   `alignmentsUniforms`'s band layout into `@jbrowse/alignments-core` is the
   worked example.
3. `pnpm gen:shaders`. A typo names the candidates; a non-scalar signature names
   the function and the offending type; a dead function says so.
4. Wire the consumer, keeping the hand-written twin **as a test fixture**.
5. Sweep generated-vs-retired over the inputs where it historically broke, then
   delete the fixture. Copy `hicShaderParity.test.ts`. If the sweep fails,
   **decide which side is right first** — `scoreToYParity` failed because the
   hand-written twin was wrong, not the generator.
6. Cross-package consumers outside the `js-export-out` package need an entry in
   that package's `exports` map (hand-maintained; `generateExports.mjs` is
   `@jbrowse/core`-only).

**Step 4 is not optional.** The generator's whole value is that it can't drift;
that only holds if each retirement was proved once.

## The residue: 9 `SYNC:` sites, classified

Ordered by what it would take to close them. **The tags were never the whole
inventory** — `grep -rn '\.slang' --include='*.ts'` turns up as many untagged
"Mirrors X.slang" comments, and that is where `mapHicCount`, `intronAlpha`,
`showChevron`, `rowBandPx`, `overlapAlpha`, `qualityFade`, `densityGradientT`,
the variant cell snap and the continuation sign arithmetic all came from. Run
that grep first.

That grep has now been walked end to end, and so have two complementary sweeps:
**every `.slang` in the repo checked for a `js-export`/`export-consts`
directive, every one without a directive read against its Canvas2D twin, and
every `static const` in every shader grepped for a TS re-typing.** That last
sweep is the cheap one and it is worth re-running after any shader gains a
constant — it is what found the wiggle rendering-mode enum and the Manhattan
glyph ids:

```sh
# name-collision sweep: shader consts that also appear in TS
grep -oP '^\s*(public\s+)?static const \w+ \K\w+' <shader>.slang
```

What that turned up is either exported now (the ADR table) or classified in
ADR-051 §"Deliberately not exported": `snpColor`/`baseColor` (per-backend
payload behind a shared dispatch), wiggle's `scoreToY` (a multiply once its
deliberately-divergent normalizer is set aside), and the arc / interleave /
packing comments, which describe buffer layouts rather than math.

**That sweep was run twice, and the second pass found something the first
missed** — `ldUniforms.slang`'s `dprimeFinalize`. The first pass had ranked
shaders by "does it have a Canvas2D twin", and the LD compute shaders read as
GPU-only. They are not: `ldCompute.slang`'s own header says its fallback is the
CPU path in `ld-core`, not a GLSL variant. **A `[shader("compute")]` pass is the
highest-stakes case in the whole inventory** — its twin computes a number the
user reads, not a pixel — so check compute shaders *first*, not last.

Three structural findings from that sweep, so it need not be redone:

- **`maf.slang` and `multiRow.slang` are entry points over `rowRect` and hold no
  math of their own.** Their decisions were already exported via `rowRect`.
- **The thin alignments passes** (`clip`, `indicator`, `coverage`,
  `interbaseHistogram`, `arcMarker`, `linkedReadLine`) are `vs_main` over
  `alignmentsUniforms` helpers. Anything shared in them is in that module, so
  that is where to look — and `coverage.slang` is the worked example of lifting
  from it.
- **The LD compute pair** (`ldCompute`, `ldPhasedCompute`) is the only
  GPU-compute-with-CPU-fallback in the tree. Their shared decision
  (`dprimeFinalize`) is exported; what is left in them is the accumulation loop,
  which the emitter refuses by design and which is a buffer walk rather than a
  decision.

Nothing obvious is left. The next export will come from a function that does not
exist yet, or from a `vs_main` body that grows a second decision worth naming.

### Closed without codegen

- **`compute.ts` linked-read pair ordering** — was TS↔TS, not shader-coupled.
  `LINKED_READ_COLOR_PAIR_*` are now *defined as* `PAIR_DIRECTION_NUM.LR` and
  friends, with the split slots numbering off the end of the pair block, so the
  two orderings cannot be renumbered apart. The general form: two TS constants
  that must be equal should *be* equal — a generated twin is for when the other
  side is the shader.

### Considered and deliberately not converted

- **`computeCorners`** (synteny ×2, dotplot ×1). The expression is
  `bpRel * bpPerPxInv + panPx` — a fused multiply-add whose drift risk is
  essentially nil, since any change to it breaks every ribbon visibly and at
  once. What those comments actually document is the *panPx convention* (why a
  fetch-time base is subtracted, and why that keeps a single Float32 sub-pixel),
  which is prose, not a formula. Converting would put four function calls per
  instance into `projectCorners`, whose own comment records that per-instance
  allocation there once dominated a pick-index profile at 500k instances. Not
  worth it; leave the comments, they are earning their keep.

### Genuinely per-backend, leave them

- **`hermiteEdges` / `sBlend` / `yCurve`** — the bezier-vs-tessellation
  equivalence, already checked numerically by `syntenyShaderParity.test.ts`.
  This is the *test oracle* shape: reach for it whenever two implementations are
  meant to differ but must stay equivalent. It is a stronger claim than a `SYNC:`
  tag and it is often the right answer.
- **`perpW` (synteny fill/stroke split, pick engine)** — the shader measures a
  per-fragment width from two edges' own foreshortenings; Canvas2D measures a
  whole-ribbon one from the corners. Different quantities, each right for the
  decision it feeds. Only the fade curve applied to them is shared, and that is
  now `thinWidthFade`.
- **`instanceInterleave` ↔ the instance layout** — buffer packing, not math.
  `assertVertexInputs.ts` is the mechanism that covers this class.
- **`syntenyFillPad.test.ts`** — a test asserting a geometry pad; the shader side
  is `thinRibbonPad`, which takes a `Corners` struct.

## Still not to be done

- **Do not transpile a vertex or fragment stage.** `chevron.slang` is the
  standing counter-example: a 12-vertex `SV_VertexID` switch with 1px AA
  extrusion and an `OFFSCREEN` culling sentinel. You would get padded clip-space
  triangles that must be undone to recover the polyline `ctx.stroke()` wants.
  Full argument in ADR-051.
- **Do not chase `fwidth`/`ddx`/`ddy`.** No pixel quad exists on the CPU. This is
  the real ceiling, and it is the right one: derivatives are *rasterization*
  math, which each backend should do its own way — Canvas2D's native AA is the
  equivalent.
- **Do not unify a deliberate divergence.** `normalizeScore` vs JS
  `makeScoreNormalizer` disagree on a degenerate (`min == max`) domain *on
  purpose*, and the AA compensations (`WIGGLE_FUDGE_FACTOR`, the variant-matrix
  `f2`, synteny's centerline stroke) are per-backend by design. Generating a twin
  silently picks a side of a product decision.
- **Do not assume already-scalar means harvestable.** Several scalar functions
  have no Canvas2D consumer at all (`discExpand`, `getGeno`, `getWord`). ADR-051
  catalogues them so the survey doesn't get redone.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  — the decision, the rejected alternatives, the export table.
- [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md) —
  Slang codegen generally.
- [reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"Keeping the two
  backends in parity" — where this sits among the other parity mechanisms.
