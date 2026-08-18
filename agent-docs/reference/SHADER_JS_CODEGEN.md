---
name: shader-js-codegen
description: How to add a function to the `//! js-export` set, retire its hand-written twin, and bump SLANG_VERSION safely — plus the emitter facts that cost a session each to establish. Read before adding an export or extending wgslToJs.ts.
audience: internal
---

# Shader → JS codegen: the operating manual

The *why*, the export table, and everything deliberately not built are
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md).
Read that first; this file is the how-to and assumes it.

It also reports **exports nothing imports**. That one is deliberately a line in
a report and not a build gate: every candidate for a gate turned out to resolve
to "leave it", and a check whose findings all end in a suppression teaches people
to suppress. It would also not catch the accretion ADR-051 actually fears, since
a *new* marginal export always has a consumer — that being why someone added it.

All six current rows were examined; re-deriving this is the waste the table
exists to prevent:

| Export | Why it stays |
| --- | --- |
| `extendToMinWidthPx` | still the shared rule. Its direct importer went away when `rectSpanPx` subsumed the call site, but `rectSpanPx`'s own twin calls it as a private helper, and the shader uses it |
| `frequencyAlpha` | production moved to `frequencyFadeGate`; the rule is unchanged and still lifted |
| `normalizeDepthScalar` | a test oracle by construction: production reads the coverage depth scale through `makeScoreNormalizer`, and this pins the GPU's copy of it to that one. Three independent normalizers with three independent floors is the bug it was split out of (`9d70e37bd9`) |
| `normalizeScore` | wiggle's normalizer, still the shared half of the deliberately-divergent `scoreToY` |
| `sBlend`, `yCurve` | the deliberate test oracles ADR-051 describes. The report agreeing with the ADR here is a check on both |

**This table was stale by one row for a day**, saying "all five" while the
generated inventory listed six — the ADR's own "a prose list of things that are
*absent* has no way to notice when it stops being true", recurring in the file
that quotes it. The generated half also went stale in the same commit, for a
reason worth knowing: the *Imported by* column is a whole-tree **TypeScript**
scan, so it moves when a consumer moves, and `pnpm gen:shaders` is a shader build
nobody re-runs after editing TS. CI's staleness gate catches it, but the red job
lands on whatever unrelated PR touched the TypeScript. If you see it, the fix is
`pnpm gen:shaders` — never `pnpm autogen`, which has no shader generator.

**What would change a verdict** is a shader-side rule that stops being shared at
all — the function deleted from the `.slang`, or its Canvas2D counterpart gone.
Not "nothing imports it", which is the state above and is fine.

**The survey is no longer a thing you run — it is generated.**
[reference/SHADER_LIFT_INVENTORY.md](SHADER_LIFT_INVENTORY.md) is written by
every full `pnpm gen:shaders`, and its Candidates table is the standing answer to
"what could be lifted and has not been". It is empty today, and a row appearing
in a diff is the signal that a shader edit created a decision nobody has made
yet — export it, or `//! js-skip` it with a reason.

That replaces a hand-run grep sweep which was declared finished twice and was
wrong both times (ADR-051's "Deliberately not exported" list carried an entry,
`textWidth`, that had quietly become false). **Do not re-run the sweep by hand.
Read the inventory, and if you think it is missing something, fix the scanner —
it uses the emitter's own parser, so anything it cannot see is something that
cannot be generated either.**

**The inventory's whole value is in its diff, so watch it for churn.** Refusal
*rows* were made stable (`refusalBucket` normalizes line numbers and slangc's
per-module suffixes), but each row carries a **count**, and a count moves
whenever any shader gains or loses a function of that shape. If that turns out to
fire on most unrelated shader edits, people will learn to skim past the file and
the mechanism is dead. **The remedy then is to drop the counts and keep the
example names** — deliberately not done pre-emptively, because the churn has not
been observed yet and a count is informative while it is stable.

The two remaining places a new export comes from: a function that does not exist
yet, and a `vs_main` body that grows a decision worth naming. The second is the
blind spot the inventory *cannot* close — it lists functions, and a decision
written inline in a vertex body is not one. `rectSpanPx` and the chevron layout
were both found that way, and both were then given names so the inventory could
see them.

## Where the pieces are

| Path | What |
| --- | --- |
| `packages/shader-tools/src/shader-codegen/wgslToJs.ts` | tokenizer + recursive-descent parser + emitter for the scalar subset of slangc's WGSL |
| `packages/shader-tools/src/shader-codegen/wgslToJs.test.ts` | weighted toward the *refusals* |
| `parseDirectives.ts` | `//! js-export:`, `//! js-export-out:`, `//! js-skip:`, and the constant evaluator (which resolves through `import`s) |
| `build-shaders.ts` `writeJsExports` | lifts from the shader's own WGSL, or from a synthesized compute wrapper for `module` files |
| `liftReport.ts` | the generated inventory + the `js-skip` staleness check |
| `check-oracle.ts`, `oracleProbe.ts` | the differential check against slangc's C++ (`pnpm check-shader-oracle`) |
| `assertVertexInputs.ts`, `assertUniformLayout.ts` | the two build-time layout gates — the instance struct and the uniform block, each against both emitted backends |
| `*.generated.ts` / `*.iface.generated.ts` / `*.consts.generated.ts` | strings / layout + packers / `export-consts` integers — three modules, one shader, see below |
| `*.js.generated.ts` | the generated twins — never hand-edit |
| `*Parity.test.ts` | the retirement gates |
| `reference/SHADER_LIFT_INVENTORY.md` | generated; candidates, declines, and the refusal surface |

Counts belong in a grep, not in prose — a hand-incremented tally lived in the old
handoff for several rounds and ended up off by a factor of four on the constants.
ADR-051 §Consequences carries the one-liners.

**Generated constants have no re-export hops.** A consumer imports from
`<base>.consts.generated.ts`, or from the package that owns the concept where a
`consts-out`/`js-export-out` put it — never through a third module that merely
passes it along. Four such chains existed and were removed; don't add one back
for convenience.

The rule is now load-bearing for the bundle rather than merely tidy. A shader
with entry points emits **three** modules — strings, `iface` (layout + packers),
`consts` — because a namespace import marks every export used, so a module is
included in a chunk whole. Importing `CS_NORMAL` from `read.generated.ts` or
`read.iface.generated.ts` compiles and passes everything, and puts 16-40 KB in
the always-loaded chunk. `reference/EAGER_BUNDLE.md` §"A namespace import is the
unit" has the measurement. A **module** file's `<base>.generated.ts` is already
consts-only, so it keeps that name.

## What actually has to agree

Worth stating plainly, because the parity machinery here is easy to read as a
demand for pixel-identical backends, and it is not one. Three tiers:

| | Standard | Examples |
| --- | --- | --- |
| **A number the user reads** | must agree | LD's r²/D' in a tooltip, a coverage depth |
| **A semantic decision** | must agree | how many chevrons a line gets, which glyph kind, whether a locus is polymorphic, that a degenerate span is a *point* |
| **Where a mark lands, to the pixel** | best effort | a half-pixel snap, an AA ramp, a min-width tick one column over |

**Only the first two are what this exists for.** The third is explicitly
per-backend — `WIGGLE_FUDGE_FACTOR`, the variant matrix's `f2` overdraw and
synteny's sub-pixel centerline stroke are AA compensation ARCHITECTURE.md tells
you *not* to port into a `.slang`, and the Canvas2D rasterizer will never match
a fragment shader's coverage anyway.

So: don't add an export to close a sub-pixel gap, don't write a test that pins
one, and if a refactor moves a mark by a pixel in a rare case, record it and
move on. The reason to generate a twin is that a hand-written one drifts
*semantically* — and you cannot tell in advance which drift will be cosmetic.

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

## Not exporting something: `//! js-skip`

The counterpart to `js-export`, and what keeps the inventory readable: most
liftable functions *should not* be lifted, and a Candidates table listing a
clip-space wrapper forever is one whose diff means nothing.

```
//! js-skip: discExpand — expands a quad so the fragment AA ramp is not clipped; Canvas2D draws ctx.arc and has no quad
```

One line per function, on the `.slang` that **authors** it (so a module-authored
decision is declined in the module, not in each importer), em dash or `--`
before the reason, free text after. Both halves are checked on every full build:
a skip naming a function the emitter can no longer see, or one that turns out to
be exported, fails `pnpm gen:shaders`. That is the part a prose list cannot do.

## Check `gen:shaders`' exit code, not its output and not `git status`

A `.slang` that fails to compile leaves its `.generated.ts` **untouched**, so
`tsc` and jest both pass off the stale module and nothing in the working tree
says a shader is out of date. Verify by grepping the emitted WGSL for what you
just wrote.

**The likeliest cause of a stale-generated case: a pass naming a packed colour
uniform must `import colorPack;` itself.** Slang does not re-export through an
import, so reaching the symbol through a module that imports it compiles
nowhere.

## Bumping `SLANG_VERSION`

```sh
pnpm gen:shaders && git diff --stat -- '**/*.generated.ts'   # read the diff
pnpm check-shader-oracle                                     # the real gate
pnpm test --testPathPatterns 'Parity\.test\.ts$'
```

The emitter is coupled to the *shape* of slangc's WGSL — identifier mangling, how
`&&` and `?:` are desugared, whether a literal arrives as `u32(10)` or `10u`.

**Two other things read that shape, and both fail the build rather than the
review**: `assertVertexInputsMatch` parses the vertex inputs out of both emitted
backends, and `assertUniformLayoutMatches` parses the uniform block out of both
and checks the reflected offsets against it. So a bump that changes how slangc
declares either struct is a `pnpm gen:shaders` failure, not a rendering bug found
later. Read the numbers those print: a full build says how many uniform blocks it
actually compared, and a run that compares none says so, because "the parser
matched nothing" and "the shader has no uniform block" are otherwise the same
green.

**`pnpm check-shader-oracle` is what makes that checkable rather than
reviewable.** slangc will also emit C++ for the same Slang, so the second
implementation is generated instead of written: the check compiles to C++,
sweeps ~400 pseudo-random argument tuples per function over pools of
exactly-float32-representable values, and compares. ~28,000 comparisons across
20 shaders, in a few seconds. A disagreement is a bug in `wgslToJs.ts`, not in
the shader.

**It sweeps every function the emitter can emit, not just the exported ones**,
and that is where its value is. An export already has a consumer and often a
hand-written parity test; the untested surface is what the emitter *could*
produce and nobody asked it to. Unexported functions have no committed twin, so
one is emitted on the fly and compared — testing the emitter rather than an
artifact, which is right, since the artifacts are pinned by the staleness check.

Widening it that way immediately found a real bug, which is the argument for it:
`vertCoverage(20, 20, 0)` was 1 on the shader and NaN in the twin.

**The corollary, which is the part that misleads: a function the emitter
*refuses* leaves the sweep silently.** `emittableOf` filters the candidates
through `emitRefusal`, so an unliftable function is dropped rather than
reported, and the comparison count simply does not grow. Make something
liftable, watch the oracle stay green, and you have proved nothing until you
check that the count moved — the usual cause is a builtin the emitter does not
implement, and a closed-form geometry solve reaches for `acos`/`cos`/`sin`
first, none of which are in `MATH_BUILTINS`. `sdEllipse` in
`alignmentsUniforms.slang` is the worked example: the scalar-core split alone
left the count unchanged, and completing it turned the function red.

**Where the oracle's authority stops, and it is not where you would guess.** It
sweeps functions, so it covers a *translation rule* only when some shader in the
tree happens to call that builtin from a liftable function. Measured against the
current tree, it exercises **eight** of the emitter's seventeen — `abs`,
`clamp`, `floor`, `log2`, `max`, `min`, `smoothstep`, `sqrt`. The remaining nine
are covered by `wgslToJs.test.ts`'s per-rule table instead, and
`TRANSLATION_RULES` is exported so that table's completeness is asserted rather
than remembered. Don't read a green oracle as "the emitter is checked"; read it
as "the emitter is checked on what the tree currently calls".

**Two builtins it cannot referee at any tolerance.** slangc lowers `lerp` to
`x + (y - x) * s` and `step` to `x < y ? 0.0f : 1.0f` for `-target cpp`, while
emitting the WGSL builtins `mix()` and `step()` for `-target wgsl`. The GPU runs
the WGSL; the oracle compares against the C++. For `mix` the two formulations
differ by an ulp everywhere and exactly at the endpoints, so the twin follows
WGSL and the oracle would fail it if `REL_TOLERANCE` were ever tightened — the
mismatch is in the *reference*, not in the tolerance. For `step` they differ
only on a NaN, and there the WGSL spec itself has been published with both
phrasings (gpuweb#4527), so the twin follows the C++ and the choice is pinned by
a test rather than defended.

The retired twins kept as fixtures still matter, and are now the *narrow* check:
they pin behavior a human decided was right (a degenerate y-domain, a
reversed-block anchor) at inputs a random sweep would rarely hit. The oracle
pins that the transliteration is faithful. Neither subsumes the other.

**The same machinery measures a shader refactor**, and that is worth reaching
for before arguing from algebra. To check whether rewriting a decision changed
anything, put the old and new formulations side by side in one throwaway
`.slang`, compile it with `-target cpp`, and sweep both from a C++ `main` — real
float32, not a `Math.fround` simulation, and the same compiler that generates
the GPU path. `rectSpanPx` is the worked example: free on cost (39 emitted ops
against 43), unchanged on every ordinary span, and a pixel different on a rare
interbase point. ADR-051 has the numbers and why that last part is a footnote.

Mechanics worth not rediscovering, all in `oracleProbe.ts`:

- `-target cpp` **segfaults** on a vertex entry point, so the check strips every
  `[shader(...)]` function and appends its own compute probe. The probe's body
  is never run — it exists only so Slang does not DCE the functions — and `main`
  calls the emitted free functions directly rather than going through slangc's
  kernel ABI.
- The probe is appended to the shader's **own source** rather than importing it
  from a wrapper. That works for a module and a stage-carrying shader alike, and
  sidesteps Slang's cross-module visibility rules, which would otherwise need
  `public` on every shader-local function in the export set.
- The C++ name is resolved from the **C++ output**, not reused from the WGSL
  resolution. The `_N` suffix counts declarations per target and the two targets
  do not declare the same set; assuming they match happens to work today and
  would fail as a comparison against the wrong function.
- **The WGSL pass uses a FRAGMENT probe, the C++ pass a COMPUTE one.** C++ has
  to be compute (the other stages segfault or error), but a compute entry may
  not reference `ddx`/`ddy`/`fwidth`, and the candidate set is chosen by
  signature before anything knows which functions use them —
  `glyphEdgeAlpha` reads as an ordinary `float -> float`. Fragment is
  permissive, so nothing is dropped from the pass that only decides what is
  emittable; by the C++ pass the list contains no derivatives, because the
  emitter refuses them.

- **`Math.min`/`Math.max` are the wrong primitives for a clamp, and NaN is why.**
  WGSL leaves min/max on a NaN indeterminate; slangc resolves them as
  `a > b ? a : b`, which **drops** the NaN and returns the bound, while JS's
  `Math.max(NaN, 0)` is NaN and propagates. So every twin that clamped
  disagreed with its shader on a NaN input — the exact split
  `ldGenotypeCorrelation`'s comment already warns about ("an unfilled cell on
  one backend and a clamped one on the other"), reintroduced generically by the
  emitter's own helpers. `_clamp` and `_smoothstep` are written as comparisons
  now. Neither behavior is *wrong* by the spec; agreeing with the compiler that
  also generates the GPU path is the only useful choice.

## Verified facts, do not re-derive

- **A parity test can pass against the very form it exists to reject, and one
  did.** `_mix` is written as WGSL's `a*(1-t) + b*t` rather than the lerp form
  `a + (b-a)*t` because only the first returns `b` exactly at `t == 1`. The test
  pinning that used `(0.1, 0.3, 1)` — a pair where **both** forms return `0.3`
  exactly — so mutating the helper to the lerp form left it green. The general
  lesson is cheap to apply: when a test's whole point is that two formulations
  differ, *run* the rejected one and check the test fails, rather than picking
  inputs by eye. Discriminating pairs are not rare (`(0.2, 0.9)`, `(0.4, 0.1)`),
  they are just not the first ones you think of.

- **slangc's CPU targets do not support graphics stages.** `-target c` on a
  vertex entry errors (`'max' not available in 'vertex' stage`); `-target cpp`
  **segfaults** (exit 139, re-confirmed against 2026.5.2). This is why module
  files get a synthesized compute wrapper.

  **`-target cpp` works on a `[shader("compute")]` entry; `-target c` does
  not** — it reports `unavailable features in entry point … for 'compute'
  stage` on the same probe `cpp` compiles cleanly. This entry previously said
  "both work", which is what the C++ oracle was built against and immediately
  disproved. `cpp` is the one to reach for.
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
- **`//! export-consts` obeys the declared Slang type, and that is recent.** The
  type used to be dropped in a non-capturing group, so every constant was
  evaluated as a float64: `static const uint FLAG = 1u << 31` exported
  `-2147483648`, `~0u` exported `-1`, and `(1u<<30)|(1u<<31)` exported
  `-1073741824` — the exact bitmask spelling the evaluator's own comment
  anticipates. `narrow()` now applies the type at every substitution (a `uint`
  referenced from a `float` expression arrives unsigned), and integer **division**
  is refused outright rather than guessed at: a negative intermediate that has
  been divided can't be reinterpreted back. Same call `wgslToJs.ts` makes, for
  the same reason — these are two evaluators over the same constants and they now
  agree about integers.
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
- **A vector or struct signature is usually a scalar decision in a wrapper**, and
  that is still the first thing to try. In almost every case the part both
  backends must agree on was already scalar, and the vector part was a
  color-space or packaging conversion each backend should keep doing its own way.

  **The exception is a returned PAIR, and `float2` is now in the subset for
  exactly that.** `rectSpanPx` is the function ADR-051 was waiting for: the two
  screen-x edges a rect paints are one decision with two numbers in it, and
  splitting it into `leftEdgePx`/`rightEdgePx` would make each recompute the
  other's branch. The support is deliberately narrow — **return position only**,
  built from `vec2<f32>(a, b)`, no vec2 params, locals, swizzles or arithmetic —
  so none of the signedness and division inference has to know about it. `vec3`
  and `vec4` are refused by name.

  Reach for it when the answer is a pair a Canvas2D call takes as two
  arguments. Do not reach for it because a signature has a `2` in it:
  `hpSplitUint` and `quadLocal` also return `float2`, and both are `js-skip`ped
  — widening the subset made them *visible* to the inventory, which is what
  forced them to be classified.
- **Not every mirror is worth converting.** The test is whether a hand-written
  twin could plausibly drift *and* the difference would be hard to see —
  `snapCellEdgePx`'s half-canvas offset passes it, a multiply-add does not.

## The two sweeps, when a shader gains a constant

**Constants only.** The inventory covers functions; nothing generates the
equivalent for `static const`, so these two greps are still hand-run. The second
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
- [reference/GPU_RENDERING.md](GPU_RENDERING.md) §"Keeping the two
  backends in parity" — where this sits among the other parity mechanisms.
