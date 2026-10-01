---
name: shader-js-codegen
description: How do I add a function to the `//! js-export` set, bump SLANG_VERSION, add or reuse a shared render-core shape module, or declare an array uniform without crashing slangc? The slang-to-JS codegen, the shape library and uniform arrays.
kind: spec
---

# Slang shaders: the JS codegen, the shape library, uniform arrays

The JS codegen lifts a shader's scalar decision functions into the Canvas2D twin;
the shape library is the set of shared render-core modules the shaders import; and
uniform arrays have one declaration rule that slangc enforces only by crashing.
The plugin-author guide is [Creating a GPU
display](https://jbrowse.org/jb2/docs/developer_guides/creating_gpu_display/).

## The JS codegen: the operating manual

The *why*, the export table, and everything deliberately not built are
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md).

**Exports nothing imports are a line in a report, not a build gate.** A check whose
findings all end in a suppression teaches people to suppress, and a *new* marginal
export always has a consumer. What changes a verdict is a shader-side rule that
stops being shared at all, never "nothing imports it".

**The survey is generated, not run.** [SHADER_LIFT_INVENTORY.md](SHADER_LIFT_INVENTORY.md)
is written by every full `pnpm gen:shaders`; its Candidates table is the standing
answer to "what could be lifted and has not been". A row appearing in a diff means
a shader edit created a decision nobody has made: export it, or `//! js-skip` it
with a reason. Don't hand-grep (two sweeps were declared finished and were wrong);
if the inventory misses something, fix the scanner. Its *Imported by* column goes
stale when a consumer moves; the fix is `pnpm gen:shaders`, never `pnpm autogen`.
The inventory lists functions and cannot see a `vs_main` body that grows a decision
worth naming (`rectSpanPx` and the chevron layout were found that way).

## Where the pieces are

| Path | What |
| --- | --- |
| `packages/shader-tools/src/shader-codegen/wgslToJs.ts` | tokenizer, parser and emitter for the scalar subset of slangc's WGSL |
| `parseDirectives.ts` | `//! js-export:`, `js-export-out:`, `js-skip:`, and the constant evaluator |
| `build-shaders.ts` `writeJsExports` | lifts from the shader's WGSL, or a synthesized compute wrapper for `module` files |
| `liftReport.ts` | the generated inventory and `js-skip` staleness check |
| `check-oracle.ts`, `oracleProbe.ts` | the differential check against slangc's C++ (`pnpm check-shader-oracle`) |
| `assertVertexInputs.ts`, `assertUniformLayout.ts` | build-time layout gates |
| `*.js.generated.ts` | the generated twins; never hand-edit |
| `*Parity.test.ts` | the retirement gates |

**Generated constants have no re-export hops.** Import from
`<base>.consts.generated.ts`, or from the package a `consts-out`/`js-export-out`
names, never through a module that passes it along. A shader with entry points
emits three modules (`SOURCE` loaders, `iface`, `consts`) and a namespace import
marks every export used, so importing `CS_NORMAL` from `read.generated.ts`
compiles and puts tens of KB in the always-loaded chunk
([EAGER_BUNDLE.md](EAGER_BUNDLE.md) §"A namespace import is the unit").

## What actually has to agree

- **A number the user reads** (LD's r²/D' in a tooltip, a coverage depth) and **a
  semantic decision** (chevrons per line, glyph kind, whether a locus is
  polymorphic, that a degenerate span is a *point*) must agree.
- **Where a mark lands, to the pixel**, is best effort per backend
  (`CANVAS_SEAM_PX`, the variant matrix's `f2` overdraw, synteny's sub-pixel
  stroke are AA compensation ARCHITECTURE.md says not to port). Don't add an export
  to close a sub-pixel gap or write a test that pins one. A hand-written twin
  drifts *semantically*, and you cannot tell in advance which drift will be
  cosmetic.

## Adding a function to the export set

0. **Check it clears the bar.** Export when the formula has a branch, a magic
   constant or a pixel snap, or a constant whose vocabulary only the shader's
   uniforms give meaning to. A two-term expression over named inputs does not (the
   `computeCorners` class). Every entry costs an import edge, a generated file and a
   parity test.
1. **Find the scalar decision.** A signature taking a `Uniforms` struct, returning
   clip space or returning a color splits into a pure scalar core and a thin
   wrapper (`snapBoxCenterYPx` / `snapBoxCenterY`).
2. Add the name to `//! js-export:`. A cross-package consumer adds `//!
   js-export-out: <repo-relative path>`. Put them on a **pass that imports it**
   only when the module's own `js-export-out` is taken.
3. `pnpm gen:shaders`.
4. Wire the consumer, keeping the hand-written twin **as a test fixture**.
5. Sweep generated-vs-retired over the inputs where it historically broke, then
   delete the fixture (copy `alphaShaderParity.test.ts`). If the sweep fails,
   **decide which side is right first**: `scoreToYParity` failed because the twin
   was wrong, not the generator.
6. A consumer outside the `js-export-out` package needs an entry in that package's
   hand-maintained `exports` map (`generateExports.mjs` is `@jbrowse/core`-only).

**Step 4 is not optional**: the generator cannot drift only if each retirement was
proved once.

**Not exporting:** one `//! js-skip: <fn> — <reason>` line per function, on the
`.slang` that **authors** it. Every full build fails on a skip naming a function
the emitter can no longer see, or one that turns out exported.

**A `.slang` that fails to compile leaves its `.generated.ts` untouched**, so `tsc`
and jest pass off the stale module. Grep the emitted WGSL for what you just wrote.
The likeliest cause: a pass naming a packed colour uniform must `import
colorPack;` itself, since Slang does not re-export through an import.

## Bumping `SLANG_VERSION`

```sh
pnpm gen:shaders && git diff --stat -- '**/*.generated.ts'   # read the diff
pnpm check-shader-oracle                                     # the real gate
pnpm test --testPathPatterns 'Parity\.test\.ts$'
```

The emitter is coupled to the shape of slangc's WGSL (identifier mangling, how `&&`
and `?:` desugar, whether a literal arrives as `u32(10)` or `10u`). The build gates
`assertVertexInputsMatch`, `assertUniformLayoutMatches` and
`assertSharedUniformBlocksAgree` read that shape too; each prints how many blocks it
compared and **zero is an error**, since "the parser matched nothing" and "no
uniform block" are otherwise the same green.

**`pnpm check-shader-oracle`** compiles each function to slangc's C++, sweeps
pseudo-random float32-representable arguments, and compares. A disagreement is a bug
in `wgslToJs.ts`, not the shader, with these exceptions and traps:

- **Intermediates are not exact.** A float32 of magnitude M carries up to `M *
  2^-24` of rounding the float64 twin does not, and an operation that drops the
  magnitude leaves all of it on a small result. `agrees()` takes slack from the
  widest FLOAT argument, not the result; integer parameters are excluded.
- **A function the emitter refuses leaves the sweep silently.** `emittableOf`
  filters through `emitRefusal`, so after making something liftable, check the
  comparison count moved. Usual cause: a missing builtin in `MATH_BUILTINS`.
- **Its authority stops at what the tree calls.** Translation rules no liftable
  function reaches are covered by `wgslToJs.test.ts`'s per-rule table
  (`TRANSLATION_RULES`).
- **`lerp` and `step` cannot be refereed.** slangc lowers them differently for
  `-target cpp` than the GPU runs. The `mix` twin follows WGSL; `step` differs only
  on NaN, where the WGSL spec has been published with both phrasings (gpuweb#4527),
  so the twin follows C++ and a test pins it.
- **`//! oracle-skip: <fn> — <why>`** is for a function some other suite referees
  (`ellipseHullPoint`, refereed by `arcHull.test.ts`), not for an unexplained
  mismatch.
- **The retired fixtures stay as the narrow check**; the oracle pins that the
  transliteration is faithful. Neither subsumes the other.
- **The same machinery measures a shader refactor**: put old and new formulations in
  one throwaway `.slang`, compile with `-target cpp`, and sweep both from a C++
  `main` before arguing from algebra.

Mechanics in `oracleProbe.ts`:

- `-target cpp` segfaults on a vertex entry, so the check strips every `[shader(...)]`
  function and appends its own compute probe.
- The C++ name resolves from the **C++ output**: the `_N` suffix counts declarations
  per target and the targets do not declare the same set.
- **The WGSL pass uses a FRAGMENT probe, the C++ pass a COMPUTE one.** Compute may
  not reference `ddx`/`ddy`/`fwidth`, and the candidate set is chosen by signature
  before anything knows which functions use them.
- **`Math.min`/`Math.max` are wrong for a clamp**: slangc resolves WGSL min/max on
  NaN as `a > b ? a : b`, while `Math.max(NaN, 0)` propagates. `_clamp` calls
  NaN-faithful `_min`/`_max` helpers.

## Verified facts

- **A parity test can pass against the very form it rejects.** `_mix` is WGSL's
  `a*(1-t) + b*t` because only that returns `b` exactly at `t == 1`; a test at
  `(0.1, 0.3, 1)` passes both forms. When a test's point is that two formulations
  differ, *run* the rejected one and watch the test fail.
- **Slang DCEs anything no entry point reaches.** For a module the wrapper is the
  only way to get WGSL; for a shader with entry points an exported function must be
  called from the draw path.
- **A whole shader's WGSL parses partially, on purpose.** Stage support code is
  parked with its refusal reason, re-thrown only if an export reaches it.
- **A regeneration touching dozens of `.generated.ts` files whenever a
  widely-imported `.slang` changes length is only GLSL `#line` numbers.** Word-diff
  before assuming a semantic change.
- **Generated JS is float64 but the *literals* are float32** (`0.35` →
  `0.34999999403953552`). It bites a consumer truncating into byte space. Parity
  tests use `toBeCloseTo`.
- **Integer `/` truncates**: the emitter emits `Math.trunc` for an integer quotient
  and refuses when it cannot tell. u32 `+`/`*` overflow is deliberately not
  modeled.
- **The literal suffix strip is base-aware**: a blind `/[fhuil]$/` turns `0xff` into
  `0xf`.
- **Integer signedness is tracked and refused-on-doubt.** Don't simplify it away:
  packed ABGR colors and flag words sit at or above 2³¹ where JS's signed coercion
  silently changes the answer.
- **`//! export-consts` obeys the declared Slang type** (`1u << 31` exports
  2147483648, not `-2147483648`); integer **division** is refused outright.
- **A `bool` parameter survives the pipeline** as a TS `boolean`, so lift
  `u.someFlag != 0` as `fn(x, bool enabled)`.
- **A vector or struct signature is usually a scalar decision in a wrapper**; the
  vector part is a packaging conversion each backend keeps its own way. **The
  exception is a returned PAIR**: `float2` is in the subset for that (`rectSpanPx`).
  Support is narrow: return position only, built from `vec2<f32>(a, b)`; `vec3` and
  `vec4` are refused by name. Reach for it when a Canvas2D call takes the answer as
  two arguments, not because a signature has a `2`.
- **Not every mirror is worth converting**: the test is whether a hand-written twin
  could plausibly drift and the difference would be hard to see.

## The two sweeps, when a shader gains a constant

The inventory covers functions; nothing generates the equivalent for `static const`,
so these greps are hand-run:

```sh
# every untagged "Mirrors X.slang" comment, not just the SYNC:-tagged ones
grep -rn '\.slang' --include='*.ts' packages plugins products

# name-collision sweep: shader consts that also appear in TS
grep -oP '^\s*(public\s+)?static const \w+ \K\w+' <shader>.slang
```

**`SYNC:` tags were never the whole inventory, and a tag can be stale.** Grep the
counterpart before trusting one. **A `[shader("compute")]` pass is the
highest-stakes case**: its twin computes a number the user reads, and the LD compute
shaders were once read as GPU-only when their fallback was the CPU path in
`ld-core`.

## The shape library

`packages/render-core/src/shaders/` holds three kinds of module:

- **Atoms**: `hpmath`, `antialias`, `colorPack`, `colorRampLut`, `scoreScale`.
  Arithmetic every shader needs, with no geometry.
- **Shapes**: `capsule`, `rowRect`, `pointGlyph`, `diagonalGrid`. A mark's
  geometry, shared by the displays that draw the same mark.
- **One pass set**: `coverageBand` plus its five entry points
  ([GPU_SHADERS.md](GPU_SHADERS.md) §Shaders).

[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
is the admission test: **two real consumers and non-obvious math**, not surface
similarity. A quad is not non-obvious; a signed-distance field with an antialias
contract is.

### Who imports what

A row gaining or losing its second importer crosses ADR-040's bar. A scan cannot
see **which half of a module a consumer takes**: `alignments/linkedReadLine`
imports `capsule` for the frame and deliberately not the coverage.

<!-- SHADER_SHAPE_CONSUMERS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Module | Importers | Imported by |
| --- | --- | --- |
| `antialias` | 18 | _most of the tree_ |
| `barMark` | 0 | — |
| `capsule` | 4 | `alignments/linkedReadLine`, `dotplot-view/dotplot`, `render-core/lineCenterMark`, `wiggle/wiggleLineCenter` |
| `clipStrip` | 3 | `render-core/barMark`, `render-core/coverageClip`, `wiggle/wiggle` |
| `colorPack` | 37 | _most of the tree_ |
| `colorRampLut` | 5 | `hic/hic`, `render-core/markColor`, `variants/ldUniforms`, `wiggle/wiggle`, `wiggle/wiggleDensity` |
| `coverageBand` | 6 | `render-core/coverageBar`, `render-core/coverageClip`, `render-core/coverageIndicator`, `render-core/coverageInterbase`, `render-core/coverageMod`, `render-core/coverageSnp` |
| `coverageBar` | 0 | — |
| `coverageClip` | 0 | — |
| `coverageIndicator` | 0 | — |
| `coverageInterbase` | 0 | — |
| `coverageMod` | 0 | — |
| `coverageSnp` | 0 | — |
| `curveDistance` | 1 | `render-core/linkMark` |
| `diagonalGrid` | 2 | `hic/hic`, `variants/ldUniforms` |
| `hpmath` | 48 | _most of the tree_ |
| `lineCenterMark` | 0 | — |
| `lineCommon` | 2 | `render-core/lineCenterMark`, `render-core/lineStepMark` |
| `lineStepMark` | 0 | — |
| `linkMark` | 0 | — |
| `markColor` | 7 | `render-core/barMark`, `render-core/lineCenterMark`, `render-core/lineCommon`, `render-core/lineStepMark`, `render-core/linkMark`, `render-core/pointMark`, `render-core/spanMark` |
| `pointGlyph` | 2 | `render-core/pointMark`, `wiggle/wiggle` |
| `pointMark` | 0 | — |
| `rowRect` | 2 | `render-core/spanMark`, `wiggle/wiggleDensity` |
| `rowTable` | 6 | `render-core/barMark`, `render-core/lineCenterMark`, `render-core/lineStepMark`, `render-core/linkMark`, `render-core/pointMark`, `render-core/spanMark` |
| `scoreScale` | 10 | `hic/hic`, `render-core/clipStrip`, `render-core/coverageBand`, `render-core/lineCommon`, `render-core/linkMark`, `render-core/markColor`, `render-core/valueScale`, `wiggle/wiggle`, `wiggle/wiggleCommon`, `wiggle/wiggleDensity` |
| `spanMark` | 0 | — |
| `valueScale` | 7 | `render-core/barMark`, `render-core/lineCenterMark`, `render-core/lineCommon`, `render-core/lineStepMark`, `render-core/linkMark`, `render-core/pointMark`, `wiggle/wiggleCommon` |

<!-- SHADER_SHAPE_CONSUMERS END -->


### The cap split: a frame is cap-agnostic, a distance is not

`capsule`'s consumers disagree about caps and **must not be made to agree**. A
stroked segment is three decisions, and only the middle one carries a cap:

- **The frame** (`capsuleFrame`): orient the segment, get a tangent and normal,
  survive a zero-length delta without 0/0.
- **The distance**: how far the fragment is from the ink, where the end's shape
  lives. `capsuleDist` rounds it; `buttSegmentCoverage`'s separable product cuts it
  square.
- **The ramp** (`edgeCoverage`): how coverage falls off over that distance, one
  function shared by every stroke whatever its cap (ADR-098).

Round caps serve dotplot (the width slider modulates line to dot, and **the dot IS
the degenerate round cap**) and the wiggle `linecenter` and render-core
`lineCenterMark` capsules (consecutive capsules share a cap at the joint, so the
max-blend pass unions them seamlessly at any angle; square caps nick sharp bends).
Butt caps serve alignments `linkedReadLine` and render-core `linkMark` under `line`,
because their Canvas2D/SVG twins stroke butt: inking round caps on a read connector
diverges from the other two backends.

#### Why there is no `capStyle` parameter

A mode is a thing every future caller has to decide and every reader has to trace.
Two named entry points instead, each in the home of its consumers, the `rampColor` /
`rampColorPremultiplied` pattern: `capsuleDist` in `capsule.slang` (round), and
`buttSegmentCoverage` in `alignmentsUniforms.slang` (butt, a box-filter product of
two `edgeCoverage` calls so the ends are as soft as the sides).
`buttSegmentCoverage.test.ts` pins the numeric cut and that each pass's generated
WGSL *and* GLSL calls it and names no round-cap distance.

### The pad is the other half of every coverage

The quad the vertex stage emits and the ramp the fragment stage shades must be
sized from one number. **Pad one without the other and the ramp is clipped at the
quad edge, silently**: coverage falls to 0.5 at the geometry boundary and the
rasterizer cuts it to 0, giving a hard 50%-alpha edge and a line narrower than
`lineWidth`.

`capsuleQuadLocal` and `segmentQuadLocal` grow the quad by exactly `aaHalfPx(dpr)`,
the ramp's reach. **Over-padding is quieter**: the surplus fragments shade to alpha 0
and are blended anyway. The pad tests assert equality, not "the ramp fits inside".
[ADR-098](../architecture-decision-records/adr-098-one-ramp-one-unit-and-the-build-checks-it.md)
is where the unit lives; [GPU_SHADERS.md](GPU_SHADERS.md) §"Antialiasing ramps"
owns the ramp-width rules.

### What is deliberately not shared

- **A colour payload.** Every shape stops at geometry. ADR-051 holds the table of
  candidates that failed.
- **The anchor a normalized score is placed against.** `scoreScale` carries a score
  to `[0,1]`; where that lands is the display's own. The four candidate unifications
  were measured and declined
  ([ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
- **The band allocators.** Sticky coverage and scrolling sections differ where they
  should; the displays share the `Band` contract and its fold (ADR-096). See
  [mechanisms/feature-band-consumers](../mechanisms/feature-band-consumers.md).

### Two ways this goes wrong quietly

1. **A comment claims sharing that is not happening.** A sharing claim is testable:
   assert the generated WGSL and GLSL call the shared function. The mirror image is
   **two names for one function, each claiming to own it**, each with a test
   importing a different one, so neither can see the other drift.
2. **Unifying a constant strands its mirrors.** A test that models a shader's
   constant copies the value, and a copy checked against itself agrees with itself.
   Grep for the **old literal** (mirrors spell the value, never the symbol), then
   make the survivor importable (`//! export-consts`).

A test modelling a shader imports every scalar it can and models only what the
emitter refuses (a `float2` signature, a struct return).

### Adding a shape, or a consumer

1. **Two real consumers first.** With one, keep the shader display-local.
2. **Take the frame and the coverage as separate questions.** A new consumer often
   wants one and not the other.
3. **Never add a mode flag to serve the second consumer.** Two named functions.
4. **State the pad and the ramp together** in the module that owns both.
5. **Run `pnpm gen:shaders` and check `git status` is clean**, not just its exit
   code: the Imported-by column of
   [SHADER_LIFT_INVENTORY.md](SHADER_LIFT_INVENTORY.md) moves when a consumer or
   test imports a generated twin, and `autogen --check` does not cover that file.

## Array members in a uniform block

A palette the shader indexes at runtime (`u.linkedReadColor[colorType]`) belongs in
the uniform block as an array, not as separately named scalars the shader cannot
subscript. The codegen reflects `kind: 'array'` and emits real element offsets.

### Declare it `float4[N]`. Never a scalar array.

```slang
public float4 linkedReadColor[LINKED_READ_COLOR_SLOTS];  // correct
public uint   linkedReadColor[LINKED_READ_COLOR_SLOTS];  // segfaults slangc, for WGSL only
```

**slangc v2026.5.2 cannot compile a scalar array in a uniform block for WGSL, and
does not say so.** It exits on signal 11 with no diagnostic. The trigger is passing
an element to a **cross-module function** (`unpackRGBA(u.linkedReadColor[i])`);
hoisting the element into a local does not help, `[ForceInline]` on the callee
emits invalid WGSL, and **GLSL compiles the same source fine**, so everything is
green until the WebGPU backend.

The rule costs nothing: `float4[9]` and `uint[9]` occupy the same bytes, since
std140 pads every array element to 16. Packing four colours to a `uint4` element
was measured and declined on alignments' palette (`ARCHITECTURAL_LIMITS.md` §"The
uniform ring"). Packing a colour into a `uint` still pays in a **vertex
attribute**, which cannot be an array.

Enforcement: `codegen.ts` refuses a scalar array in a uniform block, naming the
`float4[N]` fix; `instanceAttrs` refuses an array in an *instance* struct;
`assertModeledFieldType` (`reflection.ts`) refuses any field shape outside scalars,
vectors and uniform arrays of either, because slangc's JSON is open and the types
are closed, so an unmodeled shape (`float4x4`, a nested struct, a `bool` scalar)
otherwise falls through to whichever branch tests last. Extend the model rather than
the gate.

### Writing a palette from TS

`UNIFORM_SLOT_ARRAYS.<field>` holds the **word offset of each element**, not
consecutive: element `i` is at `base + i * uniformStride / 4`. Write through the
view the element's scalar type picks (`f32` for `float4`). Drive the loop from the
**shader's** slot count, not the palette's, so a palette out of step leaves
`undefined` rather than silently painting stale slots.

### Indexed palettes beat branch chains

Select a colour by an index the CPU already computed with an indexed palette, not an
`if (cat == RC_X)` chain: the legend and the GPU read one table, and
`colorCategory.test.ts` checks data rather than regex-scraping shader source.
**If the CPU can name a substitution, upload the substituted table.**

**Where the rule stops:** a palette something overwrites at write time.
`colorBaseA/C/G/T/N` are read under two index spaces by two shaders, and
`effectiveBaseColors` mutes all five to grey when `showModifications` is on, so a
`float4[5]` would be a second representation of a runtime-mutated colour. Declined in
[ADR-062](../architecture-decision-records/adr-062-base-colors-stay-named-uniforms.md).

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md):
  the decision, rejected alternatives, export table, what is not exported.
- [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md): Slang
  codegen generally.
- [GPU_BACKENDS.md](GPU_BACKENDS.md) §"Keeping the two backends in parity".
