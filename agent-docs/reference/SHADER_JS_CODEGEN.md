---
name: shader-js-codegen
description: How to add a function to the `//! js-export` set, retire its hand-written twin, and bump SLANG_VERSION safely — plus the emitter facts that cost a session each to establish. Read before adding an export or extending wgslToJs.ts.
audience: internal
kind: spec
---

# Shader → JS codegen: the operating manual

The *why*, the export table, and everything deliberately not built are
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md).
Read that first; this file is the how-to and assumes it.

**Exports nothing imports are a line in a report, not a build gate.** Every
candidate gate resolved to "leave it", a check whose findings all end in a
suppression teaches people to suppress, and a *new* marginal export always has a
consumer. What changes a verdict is a shader-side rule that stops being shared at
all (function deleted from the `.slang`, or its Canvas2D counterpart gone), never
"nothing imports it".

**The survey is generated, not run.** [SHADER_LIFT_INVENTORY.md](SHADER_LIFT_INVENTORY.md)
is written by every full `pnpm gen:shaders`; its Candidates table is the standing
answer to "what could be lifted and has not been". A row appearing in a diff means a
shader edit created a decision nobody has made: export it, or `//! js-skip` it with
a reason. Don't re-run a hand grep sweep (two were declared finished and were
wrong); if the inventory misses something, fix the scanner, which uses the emitter's
own parser. The inventory's *Imported by* column is a whole-tree TypeScript scan, so
it goes stale when a consumer moves; the fix is `pnpm gen:shaders`, never `pnpm
autogen`. Refusal rows are stable (`refusalBucket`) but carry counts; if counts churn
on most shader edits, drop them and keep example names.

Two places a new export comes from: a function that does not exist yet, and a
`vs_main` body that grows a decision worth naming (the inventory lists functions and
cannot see an inline one; `rectSpanPx` and the chevron layout were found that way).

## Where the pieces are

| Path | What |
| --- | --- |
| `packages/shader-tools/src/shader-codegen/wgslToJs.ts` | tokenizer + parser + emitter for the scalar subset of slangc's WGSL; `wgslToJs.test.ts` is weighted toward refusals |
| `parseDirectives.ts` | `//! js-export:`, `js-export-out:`, `js-skip:`, and the constant evaluator (resolves through `import`s) |
| `build-shaders.ts` `writeJsExports` | lifts from the shader's WGSL, or a synthesized compute wrapper for `module` files |
| `liftReport.ts` | the generated inventory and `js-skip` staleness check |
| `check-oracle.ts`, `oracleProbe.ts` | the differential check against slangc's C++ (`pnpm check-shader-oracle`) |
| `assertVertexInputs.ts`, `assertUniformLayout.ts` | build-time layout gates |
| `*.generated.ts` / `*.iface.generated.ts` / `*.consts.generated.ts` | `SOURCE` / layout + packers / `export-consts` integers; WGSL/GLSL text sits in `*.wgsl.generated.ts` / `*.glsl.generated.ts`, reached only by `SOURCE`'s `import()`s |
| `*.js.generated.ts` | the generated twins; never hand-edit |
| `*Parity.test.ts` | the retirement gates |

**Generated constants have no re-export hops.** Import from
`<base>.consts.generated.ts`, or from the package that owns the concept where a
`consts-out`/`js-export-out` put it, never through a module that passes it along.
This is load-bearing for the bundle: a shader with entry points emits three modules
(`SOURCE` loaders, `iface`, `consts`) and a namespace import marks every export used,
so importing `CS_NORMAL` from `read.generated.ts` compiles and puts 16-40 KB in the
always-loaded chunk ([EAGER_BUNDLE.md](EAGER_BUNDLE.md) §"A namespace import is the
unit"). A module file's `<base>.generated.ts` is already consts-only.

## What actually has to agree

| | Standard | Examples |
| --- | --- | --- |
| **A number the user reads** | must agree | LD's r²/D' in a tooltip, a coverage depth |
| **A semantic decision** | must agree | chevrons per line, glyph kind, whether a locus is polymorphic, that a degenerate span is a *point* |
| **Where a mark lands, to the pixel** | best effort | a half-pixel snap, an AA ramp, a min-width tick one column over |

The third tier is per-backend (`CANVAS_SEAM_PX`, the variant matrix's `f2` overdraw
and synteny's sub-pixel stroke are AA compensation ARCHITECTURE.md says not to port).
Don't add an export to close a sub-pixel gap or write a test that pins one. A
hand-written twin drifts *semantically*, and you cannot tell in advance which drift
will be cosmetic.

## Adding a function to the export set

0. **Check it clears the bar.** Export when the formula has a branch, a magic
   constant or a pixel snap, or a constant whose vocabulary only the shader's
   uniforms give meaning to. A two-term expression over named inputs does not (the
   `computeCorners` class). Every entry costs an import edge, a generated file and a
   parity test.
1. **Find the scalar decision.** If the signature takes a `Uniforms` struct, returns
   clip space, or returns a color, split it into a pure scalar core and a thin
   wrapper (`snapBoxCenterYPx` / `snapBoxCenterY`, `fillShade` / `shadeFill`).
2. Add the name to `//! js-export:`. For a cross-package consumer add `//!
   js-export-out: <repo-relative path>`, which redirects (one generated file). Put
   them on a **pass that imports it** only when the module's own `js-export-out` is
   taken: a shader with entry points can export a function it only imports (a
   module's synthesized wrapper cannot see past its own module).
3. `pnpm gen:shaders`. A typo names the candidates, a non-scalar signature names the
   function and type, a dead function says so.
4. Wire the consumer, keeping the hand-written twin **as a test fixture**.
5. Sweep generated-vs-retired over the inputs where it historically broke, then
   delete the fixture (copy `alphaShaderParity.test.ts`). If the sweep fails,
   **decide which side is right first**: `scoreToYParity` failed because the twin was
   wrong (`|| 1` vs `max(range, 1e-6)`), not the generator.
6. A consumer outside the `js-export-out` package needs an entry in that package's
   hand-maintained `exports` map (`generateExports.mjs` is `@jbrowse/core`-only).

**Step 4 is not optional**: the generator's value, that it cannot drift, holds only
if each retirement was proved once.

## Not exporting something: `//! js-skip`

```
//! js-skip: discExpand — expands a quad so the fragment AA ramp is not clipped; Canvas2D draws ctx.arc and has no quad
```

One line per function, on the `.slang` that **authors** it, em dash or `--` before
the reason. Every full build fails on a skip naming a function the emitter can no
longer see, or one that turns out exported.

## Check `gen:shaders`' exit code

A `.slang` that fails to compile leaves its `.generated.ts` **untouched**, so `tsc`
and jest pass off the stale module and nothing in the working tree says a shader is
out of date. Grep the emitted WGSL for what you just wrote. **The likeliest cause: a
pass naming a packed colour uniform must `import colorPack;` itself**; Slang does not
re-export through an import.

## Bumping `SLANG_VERSION`

```sh
pnpm gen:shaders && git diff --stat -- '**/*.generated.ts'   # read the diff
pnpm check-shader-oracle                                     # the real gate
pnpm test --testPathPatterns 'Parity\.test\.ts$'
```

The emitter is coupled to the shape of slangc's WGSL (identifier mangling, how `&&`
and `?:` desugar, whether a literal arrives as `u32(10)` or `10u`). Two build gates
read that shape too: `assertVertexInputsMatch` parses the vertex inputs of both
backends, and `assertUniformLayoutMatches` the uniform block of both against the
reflected offsets. `assertSharedUniformBlocksAgree` checks a *group*: shaders sharing
a `struct` declaration share a buffer (`GpuAlignmentsRenderer` writes one UBO through
`read.slang`'s `UNIFORM_OFFSET_*`), so the group must lay it out identically. Each
prints how many blocks it compared and **zero is an error**, since "the parser matched
nothing" and "no uniform block" are otherwise the same green.

**`pnpm check-shader-oracle`** makes the emitter checkable: slangc also emits C++, so
the check compiles to C++, sweeps pseudo-random argument tuples per function over
exactly-float32-representable pools, and compares. A disagreement is a bug in
`wgslToJs.ts`, not the shader, with the exceptions below.

- **Intermediates are not exact, and that can be a real red.** A float32 of magnitude
  M carries up to `M * 2^-24` of rounding the float64 twin does not, and an operation
  that drops the magnitude leaves all of it on a small result (`(hueDeg / 360.0) *
  6.0` then `% 2.0`). `agrees()` takes slack from the widest FLOAT argument of the
  call, not the result. Integer parameters are excluded (`UINT_POOL` reaches
  4294967295 and would put slack at 256 and referee nothing).
- **It sweeps every function the emitter can emit, not only exports**; an unexported
  one is emitted on the fly. That immediately found `vertCoverage(20, 20, 0)` = 1 on
  the shader and NaN in the twin.
- **A function the emitter refuses leaves the sweep silently.** `emittableOf` filters
  through `emitRefusal`, so an unliftable function is dropped and the comparison count
  does not grow. After making something liftable, check the count moved. Usual cause:
  a missing builtin (`acos`/`cos`/`sin` are not in `MATH_BUILTINS`; `sdEllipse` is the
  worked example).
- **Its authority stops at what the tree calls.** It covers a translation rule only
  when some liftable function calls that builtin; the rest are covered by
  `wgslToJs.test.ts`'s per-rule table, whose completeness is asserted via the exported
  `TRANSLATION_RULES`. A green oracle means "checked on what the tree currently calls".
- **`lerp` and `step` cannot be refereed.** slangc lowers `lerp` to `x + (y - x) * s`
  and `step` to a ternary for `-target cpp` while the GPU runs WGSL `mix()`/`step()`.
  The `mix` twin follows WGSL (differs by an ulp, exact at endpoints; the oracle would
  fail it if `REL_TOLERANCE` tightened). `step` differs only on NaN, where the WGSL
  spec has been published with both phrasings (gpuweb#4527), so the twin follows C++
  and a test pins it.
- **`//! oracle-skip: <fn> — <why>`** takes a function out of the sweep; the oracle
  prints every skip and fails on one it would not have swept. Use it for a function
  some other suite referees against geometry (`curveDistance.slang`'s
  `ellipseHullPoint` / `wideCircleHullPoint`, refereed by `arcHull.test.ts`: the probe
  hands them near-parallel tangent configurations no float32/float64 tolerance
  survives), not for an unexplained mismatch.
- **The retired fixtures stay as the narrow check** (they pin behavior a human decided
  is right at inputs a random sweep rarely hits); the oracle pins that the
  transliteration is faithful. Neither subsumes the other.
- **The same machinery measures a shader refactor**: put old and new formulations in
  one throwaway `.slang`, compile with `-target cpp`, and sweep both from a C++ `main`
  (real float32, same compiler as the GPU path) before arguing from algebra.

Mechanics in `oracleProbe.ts`:

- `-target cpp` segfaults on a vertex entry, so the check strips every `[shader(...)]`
  function and appends its own compute probe (never run; it exists so Slang does not
  DCE the functions).
- The probe is appended to the shader's **own source**, which works for modules and
  stage-carrying shaders and sidesteps cross-module visibility.
- The C++ name resolves from the **C++ output**: the `_N` suffix counts declarations
  per target and the targets do not declare the same set.
- **The WGSL pass uses a FRAGMENT probe, the C++ pass a COMPUTE one.** Compute may not
  reference `ddx`/`ddy`/`fwidth`, and the candidate set is chosen by signature before
  anything knows which functions use them (`glyphEdgeAlpha` reads as an ordinary
  `float -> float`).
- **`Math.min`/`Math.max` are wrong for a clamp**: slangc resolves WGSL min/max on NaN
  as `a > b ? a : b`, dropping the NaN, while `Math.max(NaN, 0)` propagates. `_clamp`
  calls NaN-faithful `_min`/`_max` helpers and `_smoothstep` uses comparisons.
  Agreeing with the compiler that generates the GPU path is the only useful choice.

## Verified facts

- **A parity test can pass against the very form it rejects.** `_mix` is WGSL's
  `a*(1-t) + b*t` because only that returns `b` exactly at `t == 1`; the test used
  `(0.1, 0.3, 1)`, where both forms return `0.3`, so mutating to the lerp form stayed
  green. When a test's point is that two formulations differ, *run* the rejected one
  and watch the test fail (discriminating pairs: `(0.2, 0.9)`, `(0.4, 0.1)`).
- **slangc CPU targets do not support graphics stages.** `-target c` on a vertex entry
  errors; `-target cpp` segfaults. `cpp` works on a `[shader("compute")]` entry and `c`
  does not (`unavailable features in entry point`); reach for `cpp`.
- **Slang DCEs anything no entry point reaches.** For a module the wrapper is the only
  way to get WGSL; for a shader with entry points an exported function must be called
  from the draw path.
- **A whole shader's WGSL parses partially, on purpose.** Stage support code (`vec4`
  math, `ptr<function, Uniforms>`, texture samples) is parked with its refusal reason,
  re-thrown only if an export reaches it.
- **A regeneration touching ~85 `.generated.ts` files whenever a widely-imported
  `.slang` changes length is only GLSL `#line` numbers.** Word-diff before assuming a
  semantic change.
- **Generated JS is float64 but the *literals* are float32** (`0.35` →
  `0.34999999403953552`). It bites a consumer truncating into byte space (synteny's
  fill rounds). Parity tests use `toBeCloseTo`.
- **Integer `/` truncates; the emitter emits `Math.trunc` for an integer quotient** and
  refuses when it cannot tell (`vid / 6u` is 1 on the GPU and 1.166… naively; `insertion.slang`'s
  `vs_main` contains it). `%` needs nothing. u32 `+`/`*` overflow is deliberately not
  modeled.
- **The literal suffix strip is base-aware**: a blind `/[fhuil]$/` turns `0xff` into
  `0xf`. Hex was the unreadable form twice (here and `evalConstExpr`); slangc emits
  decimal today, which is why both were latent.
- **Integer signedness is tracked and refused-on-doubt.** Don't simplify it away:
  packed ABGR colors and flag words sit at or above 2³¹ where JS's signed coercion
  silently changes the answer.
- **`//! export-consts` obeys the declared Slang type.** `narrow()` applies it at every
  substitution (`1u << 31` exports 2147483648, not `-2147483648`); integer **division**
  is refused outright. Both evaluators (`wgslToJs.ts` and this) agree about integers.
- **Factoring a decision into its own scalar function is free on the GPU** (every
  downstream compiler inlines a scalar leaf) **and ~0.5 ns/item on the CPU**, only
  where the call defeats loop-invariant hoisting (`getDensityColor`). Respect the carve-out
  for genuinely hot loops (`computeCorners`, 500k instances).
- **A `bool` parameter survives the pipeline** as a TS `boolean`, so lift
  `u.someFlag != 0` as `fn(x, bool enabled)` (`qualityFade`). slangc expands `&&` into
  an `if`/`else` over a temporary, so the JS is longer than the Slang.
- **A vector or struct signature is usually a scalar decision in a wrapper**; the
  vector part is a packaging conversion each backend keeps its own way. **The exception
  is a returned PAIR**: `float2` is in the subset for that (`rectSpanPx`: the two
  screen-x edges one rect paints are one decision). Support is narrow: return position
  only, built from `vec2<f32>(a, b)`, no vec2 params/locals/swizzles/arithmetic; `vec3`
  and `vec4` are refused by name. Reach for it when a Canvas2D call takes the answer as
  two arguments, not because a signature has a `2` (`hpSplitUint` and `quadLocal` are
  `js-skip`ped).
- **Not every mirror is worth converting**: the test is whether a hand-written twin
  could plausibly drift and the difference would be hard to see (`snappedCellLeftPx`'s
  reversed-block pivot passes; a multiply-add does not).

## The two sweeps, when a shader gains a constant

The inventory covers functions; nothing generates the equivalent for `static const`,
so these greps are hand-run (they found the wiggle rendering-mode enum and the
Manhattan glyph ids):

```sh
# every untagged "Mirrors X.slang" comment, not just the SYNC:-tagged ones
grep -rn '\.slang' --include='*.ts' packages plugins products

# name-collision sweep: shader consts that also appear in TS
grep -oP '^\s*(public\s+)?static const \w+ \K\w+' <shader>.slang
```

**`SYNC:` tags were never the whole inventory, and a tag can be stale** (six named
`read.slang` branches deleted when read classification moved to the CPU). Grep the
counterpart before trusting one. Recount rather than restate; each falls in a class
ADR-051 classifies.

- **The thin alignments passes** (`clip`, `arcMarker`, `linkedReadLine`) are `vs_main`
  over `alignmentsUniforms` helpers, so anything shared is in that module. The coverage
  band's was the same shape and is now render-core's `coverageBand.slang`, a shared
  module with its own `js-export-out`: the simpler arrangement to copy.
- **A `[shader("compute")]` pass is the highest-stakes case**: its twin computes a
  number the user reads. Check compute shaders first. The LD compute shaders were read
  as GPU-only when their fallback was the CPU path in `ld-core`. The one compute pass
  now is `tree-sidebar`'s `sampleDistance.slang`.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md):
  the decision, rejected alternatives, export table, what is not exported.
- [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md): Slang
  codegen generally.
- [GPU_RENDERING.md](GPU_RENDERING.md) §"Keeping the two backends in parity".
