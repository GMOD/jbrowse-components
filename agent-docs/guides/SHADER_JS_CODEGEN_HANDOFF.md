# Shader → JS codegen: handoff

2026-08-04. `//! js-export` ships: four shaders now generate the scalar
decisions their Canvas2D/SVG twins used to hand-port. The *why*, including
everything deliberately not built, is
[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
— read it first, this file assumes it.

## What exists

| Path | What |
| --- | --- |
| `packages/shader-tools/src/shader-codegen/wgslToJs.ts` | tokenizer + recursive-descent parser + emitter for the scalar subset of slangc's WGSL |
| `packages/shader-tools/src/shader-codegen/wgslToJs.test.ts` | 12 tests, weighted toward the *refusals* |
| `parseDirectives.ts` `parseJsExports` | parses `//! js-export:`, resolves each Slang signature, rejects non-scalar ones by name |
| `build-shaders.ts` `writeJsExports` | synthesizes a compute wrapper, compiles it, lifts the bodies into `<base>.js.generated.ts` |
| `*.js.generated.ts` (4 files) | the generated twins — never hand-edit |
| `hpmathParity.test.ts`, `frequencyAlphaParity.test.ts`, `syntenyShaderParity.test.ts`, `pointMarkerParity.test.ts` | the retirement gates |

Exported today, and what each replaced, is the table in ADR-051. Four shaders:
`hpmath`, `alignmentsUniforms`, `syntenyTypes`, `pointGlyph`.

## Verified facts, do not re-derive

- **slangc's CPU targets do not support graphics stages.** `-target c` on a
  vertex entry errors (`'max' not available in 'vertex' stage`); `-target cpp`
  **segfaults** (exit 139). Both work on a `[shader("compute")]` entry. This is
  why the driver synthesizes a compute wrapper rather than compiling the module.
- **Slang DCEs anything no entry point reaches**, so asking for a module's WGSL
  directly returns nothing. The wrapper exists solely to keep the functions live.
- **`-target spirv` works on a vertex entry** (unlike `cpp`), so SPIR-V is
  available if a per-fragment oracle is ever wanted. It was rejected as the IR
  here for readability/control-flow reasons — see the ADR.
- **The regeneration touches ~85 `.generated.ts` files whenever `hpmath.slang`
  changes length, and the only delta is GLSL `#line` debug numbers.** Word-diff
  before assuming a semantic change. This is what hpmath's header comment warns
  about; append new functions at the end of that file when you can.
- **Generated JS is float64, the shader is float32.** Not bit-exact, deliberately
  — the hand-written twins were float64 too. Parity tests assert behavior, never
  bit patterns.

## Adding a function to the export set

1. Make it `public` and **pure scalar** (`float`/`uint`/`int`/`bool` only). If
   the natural signature takes a `Uniforms` struct or returns clip space, split
   it: pure px-in/px-out core, thin wrapper around it. `snapBoxCenterYPx` /
   `snapBoxCenterY` and `extendToMinWidthPx` / `extendToMinWidthX` are the
   pattern; the shader's own call sites stay unchanged.
2. Add the name to `//! js-export:`.
3. `pnpm gen:shaders`. A typo names the candidates; a non-scalar signature names
   the function and the offending type.
4. Wire the consumer, keeping the hand-written twin **as a test fixture**.
5. Sweep generated-vs-retired over the inputs where it historically broke, then
   delete the fixture. Copy `hpmathParity.test.ts`.
6. Cross-package consumers need an entry in `packages/render-core/package.json`
   `exports` (hand-maintained; `generateExports.mjs` is `@jbrowse/core`-only).

**Step 4 is not optional.** The generator's whole value is that it can't drift;
that only holds if each retirement was proved once.

## Work queue, in the order I would take it

### 1. `js-export` on non-module shaders (small)

Today `writeJsExports` runs only for `module` files, because the wrapper
`import`s the module. A shader with entry points can't be imported — but
`compileOne` **already has its WGSL**, so lift from that string instead of
compiling a wrapper. Perhaps 30 lines. This is the blocker for anything in
`wiggle.slang` / `manhattan.slang` / `rect.slang`.

### 2. Vector support (the big one)

Unlocks the largest remaining cluster: `unpackRGBA` (colorPack), synteny's
`shadeFill` (the last `SYNC:` in that plugin), HiC's `mapHicCount`, and the
alpha math generally.

- **Scalarize; do not emit a `Vec` class.** A `vec4` becomes four locals. These
  run per feature per frame — see `spanLeft`'s doc comment on not allocating.
- **Bit ops are the first real semantic gap.** WGSL `>>` on a `u32` must become
  `>>>`, and JS bitwise operators coerce to int32, so a color above 2³¹ needs
  care. The emitter already tracks types (`SCALAR_TYPES`); use them, and test the
  boundary values rather than assuming.
- `UNSUPPORTED_BUILTINS` is the list to shrink. Anything moved out of it needs
  *exact* JS semantics, not approximate.

### 3. Harvest what vector support unlocks

Same procedure as above. `mapHicCount` is the easiest first: `colorRamp.ts:195`
says "Mirrors the logic in hic.slang's fragment shader", and the `t` computation
is already scalar — it just lives inline in `fs_main` and needs the factoring
from step 1 of the recipe. It may not even need vectors.

## Do not do these

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
- **Do not assume already-scalar means harvestable.** Of the 19 scalar-only
  functions in the tree, several have no Canvas2D consumer at all (`discExpand`,
  `textWidth`, `getGeno`, `getWord`). ADR-051 catalogues them so the survey
  doesn't get redone.

## The third category, worth knowing about

Synteny's `sBlend`/`yCurve` are exported as a **test oracle**, not production
code. Canvas2D deliberately draws one `bezierCurveTo` rather than tessellating,
and `syntenyRibbonPath.ts` carried an algebraic proof that the two are identical
— as a comment. `syntenyShaderParity.test.ts` now checks that algebra
numerically at 101 points to 10 decimals.

Reach for this shape whenever two implementations are *meant* to differ but must
stay equivalent. It is often the right answer where sharing the code would make
the Canvas2D path worse, and it is a stronger claim than a `SYNC:` tag.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  — the decision, the rejected alternatives, the export table.
- [ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md) —
  Slang codegen generally.
- [reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"Keeping the two
  backends in parity" — where this sits among the other parity mechanisms.
- 26 `SYNC:` sites remain (17 synteny, 8 alignments, 1 dotplot). Machine-checking
  those pairs in CI is a separate, cheap job that covers the residue codegen
  structurally cannot reach.
