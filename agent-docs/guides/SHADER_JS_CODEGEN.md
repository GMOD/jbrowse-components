---
name: shader-js-codegen
description: How to add a function to the `//! js-export` set, retire its hand-written twin, and bump SLANG_VERSION safely — plus the emitter facts that cost a session each to establish. Read before adding an export or extending wgslToJs.ts.
---

# Shader → JS codegen: the operating manual

The *why*, the export table, and everything deliberately not built are
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md).
Read that first; this file is the how-to and assumes it.

The survey that produced this is finished. Every `.slang` in the tree was checked
for a directive, every one without a directive read against its Canvas2D twin,
and every `static const` grepped for a TS re-typing — twice. What that turned up
is either exported (ADR-051's table) or classified under its "Deliberately not
exported". **The next export will come from a function that does not exist yet,
or from a `vs_main` body that grows a second decision worth naming.**

## Where the pieces are

| Path | What |
| --- | --- |
| `packages/shader-tools/src/shader-codegen/wgslToJs.ts` | tokenizer + recursive-descent parser + emitter for the scalar subset of slangc's WGSL |
| `packages/shader-tools/src/shader-codegen/wgslToJs.test.ts` | weighted toward the *refusals* |
| `parseDirectives.ts` | `//! js-export:`, `//! js-export-out:`, and the constant evaluator (which resolves through `import`s) |
| `build-shaders.ts` `writeJsExports` | lifts from the shader's own WGSL, or from a synthesized compute wrapper for `module` files |
| `*.js.generated.ts` | the generated twins — never hand-edit |
| `*Parity.test.ts` | the retirement gates |

Counts belong in a grep, not in prose — a hand-incremented tally lived in the old
handoff for several rounds and ended up off by a factor of four on the constants.
ADR-051 §Consequences carries the one-liners.

**Generated constants have no re-export hops.** A consumer imports from the
generated module, or from the package that owns the concept where a
`consts-out`/`js-export-out` put it — never through a third module that merely
passes it along. Two such chains existed and were removed; don't add one back for
convenience.

## Adding a function to the export set

0. **Check it clears the bar.** Export when the formula has a branch, a magic
   constant or a pixel snap, or when the constant is a vocabulary only the
   shader's uniforms give meaning to. A two-term expression over named inputs
   does *not* clear it — that is the `computeCorners` class, and
   `covBottomOffsetPx` (`covHeight - covYOffset`) is the marginal case already
   over the line. Every entry costs an import edge, a generated file and a parity
   test, so the table should stop growing well before it reaches "every scalar
   expression in every shader".
1. **Find the scalar decision.** If the natural signature takes a `Uniforms`
   struct, returns clip space, or returns a color, **split it**: pure scalar
   core, thin wrapper the shader's own call sites keep using.
   `snapBoxCenterYPx` / `snapBoxCenterY` and `fillShade` / `shadeFill` are the
   pattern.
2. Add the name to `//! js-export:`. Cross-package consumer? Add
   `//! js-export-out: <repo-relative path>` — it redirects, so there is exactly
   one generated file. If the decision belongs in a shared *module* but the twin
   has to land somewhere that module's own package can't reach, put both
   directives on a **pass that imports it** instead: the name resolves through
   imports for a shader with entry points. `coverage.slang` exporting
   `alignmentsUniforms`'s band layout into `@jbrowse/alignments-core` is the
   worked example.
3. `pnpm gen:shaders` — **not `pnpm autogen`**, which has no shader generator. A
   typo names the candidates; a non-scalar signature names the function and the
   offending type; a dead function says so.
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

## Bumping `SLANG_VERSION`

The retired twins kept as fixtures are the oracle for a desugaring change, which
is the whole reason they are kept rather than deleted. A pin bump is:

```sh
pnpm gen:shaders && git diff --stat -- '**/*.generated.ts'   # read the diff
pnpm test --testPathPatterns 'Parity\.test\.ts$'
```

The emitter is coupled to the *shape* of slangc's WGSL — identifier mangling, how
`&&` and `?:` are desugared, whether a literal arrives as `u32(10)` or `10u`.
Nothing else in the tree depends on that shape, so this is the only place a bump
can go quietly wrong.

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
- **The regeneration touches ~85 `.generated.ts` files whenever a
  widely-imported `.slang` changes length, and the only delta is GLSL `#line`
  debug numbers.** Word-diff before assuming a semantic change.
- **Generated JS is float64, the shader is float32 — but the *literals* are
  float32.** `0.35` comes back as `0.34999999403953552`. Harmless in float space;
  it bites a consumer that truncates into byte space, which is why synteny's fill
  now rounds. Parity tests use `toBeCloseTo`, never bit equality.
- **Integer `/` truncates; the other arithmetic operators are float64.** WGSL
  divides integers with truncation and JS does not, so `vid / 6u` is 1 on the GPU
  and 1.166… in a naive transliteration — wrong for *ordinary in-range* inputs,
  not just at the type's edges, and `vs_main` in `insertion.slang` really does
  contain `vid_1 / u32(6)`. The emitter emits `Math.trunc` for an integer
  quotient and refuses when it cannot tell. `%` needs nothing (both languages
  take the sign of the dividend and truncate toward zero). u32 `+`/`*`
  **overflow** is deliberately not modeled: it needs 2³²-scale inputs no exported
  decision approaches, and float64 loses bits before a mask could restore the
  wrap anyway.
- **The literal suffix strip is base-aware, and has to be.** A hex literal's
  digits can end in `f`, so a blind `/[fhuil]$/` turns `0xff` into `0xf` — 255
  silently becomes 15 — and `0xf` into the unparseable `0x`. This is the second
  time hex has been the one form the pipeline could not read; the first was
  `evalConstExpr` in `parseDirectives.ts`. slangc emits decimal today, so both
  were latent, which is exactly why they survived.
- **Integer signedness is tracked and refused-on-doubt.** Don't "simplify" that
  away — the values that need it (packed ABGR colors, flag words) are exactly the
  ones at or above 2³¹ where JS's signed coercion silently changes the answer.
- **Factoring a decision into its own scalar function is free on the GPU and
  ~0.5 ns/item on the CPU.** Slang keeps the function in the emitted WGSL (that
  is exactly what makes the lift possible) and every downstream compiler inlines
  a scalar leaf — there is no call stack on a GPU. The measurable cost is all on
  the consumer side, and only where the call defeats loop-invariant hoisting:
  `getDensityColor` lost a hoisted reciprocal and measured 1.22× on that
  arithmetic, 0.56 ns/feature. Don't pre-optimize this; do respect the existing
  carve-out for genuinely hot loops (`computeCorners`, 500k instances).
- **A shader can export a function it only `import`s** (entry-point shaders only —
  a module's synthesized wrapper cannot see past its own module, and the error
  says so). This is how a decision authored in a shared module reaches a package
  that module's plugin cannot write into, without a new `.slang` file existing
  only to own a `js-export-out`. Reach for it before concluding "the destination
  is wrong, so leave the twin hand-written" — that conclusion was drawn once and
  was wrong.
- **A retirement gate is a bug detector, not a formality.** `scoreToYParity`
  failed on its first run: Manhattan's JS and shader spelled the degenerate
  y-domain guard differently (`|| 1` vs `max(range, 1e-6)`) and the shader's own
  comment claimed they matched. When a sweep fails, work out which side is right;
  do not adjust the fixture to agree.
- **A `bool` parameter survives the whole pipeline** and lands as a TS `boolean`,
  so a shader-side `u.someFlag != 0` should be lifted as `fn(x, bool enabled)`
  rather than an int — the consumer then passes its existing boolean.
  `qualityFade` is the first export doing this. Note slangc expands the `&&` in
  its body into an `if`/`else` over a `_S5` temporary, so the generated JS is
  longer than the Slang; that is the desugaring, not a bug.
- **A vector or struct signature is usually a scalar decision in a wrapper.**
  Working the candidates one at a time found that in every case the part both
  backends must agree on was already scalar, and the vector part was a
  color-space or packaging conversion each backend should keep doing its own way.
  So vector support is *unproven* rather than blocked — build it when a function
  turns up whose **decision** is genuinely vector-valued. The gap that was real
  turned out to be integer semantics, not vectors.
- **Not every mirror is worth converting.** The test is whether a hand-written
  twin could plausibly drift *and* the difference would be hard to see —
  `snapCellEdgePx`'s half-canvas offset passes it, a multiply-add does not.

## The two sweeps, when a shader gains a constant

Cheap, and worth re-running rather than trusting a past result — the second one
is what found the wiggle rendering-mode enum and the Manhattan glyph ids.

```sh
# every untagged "Mirrors X.slang" comment, not just the SYNC:-tagged ones
grep -rn '\.slang' --include='*.ts' packages plugins products

# name-collision sweep: shader consts that also appear in TS
grep -oP '^\s*(public\s+)?static const \w+ \K\w+' <shader>.slang
```

**`SYNC:` tags were never the whole inventory, and a tag can be stale.** Six in
`colorUtils.ts` / `colorSchemes.ts` / `insertSizeStats.ts` named `read.slang`
branches deleted when read classification moved to the CPU. Grep the counterpart
before trusting a tag, and before counting one — `grep -rn 'SYNC:' --include='*.ts'
packages plugins products` currently returns 10, all in synteny and dotplot, and
each falls in a class ADR-051 classifies (`computeCorners` ×3,
`instanceInterleave` ×2 plus the silhouette predicate, `perpW` ×2, `sBlend`, the
fill pad). Recount rather than restate.

Three structural findings from that sweep, so it need not be redone:

- **`maf.slang` and `multiRow.slang` are entry points over `rowRect`** and hold no
  math of their own. Their decisions were already exported via `rowRect`.
- **The thin alignments passes** (`clip`, `indicator`, `coverage`,
  `interbaseHistogram`, `arcMarker`, `linkedReadLine`) are `vs_main` over
  `alignmentsUniforms` helpers. Anything shared in them is in that module, so
  that is where to look — and `coverage.slang` is the worked example of lifting
  from it.
- **A `[shader("compute")]` pass is the highest-stakes case in the whole
  inventory** — its twin computes a number the user reads, not a pixel — so check
  compute shaders *first*, not last. The first sweep ranked shaders by "does it
  have a Canvas2D twin" and read the LD compute shaders as GPU-only. They are
  not: `ldCompute.slang`'s header says its fallback is the CPU path in `ld-core`,
  which is how `ldUniforms.slang`'s `dprimeFinalize` was missed on pass one.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  — the decision, the rejected alternatives, the export table, and what is
  deliberately not exported.
- [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md) —
  Slang codegen generally.
- [reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"Keeping the two
  backends in parity" — where this sits among the other parity mechanisms.
