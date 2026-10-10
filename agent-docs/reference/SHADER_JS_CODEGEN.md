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

**Exports nothing imports are a line in a report, not a build gate.** A check whose
findings all end in a suppression teaches people to suppress, and a *new* marginal
export always has a consumer. What changes a verdict is a shader-side rule that
stops being shared at all, never "nothing imports it".

**Generated constants have no re-export hops.** Import from
`<base>.consts.generated.ts`, or from the package a `consts-out`/`js-export-out`
names, never through a module that passes it along. A shader with entry points
emits three modules (`SOURCE` loaders, `iface`, `consts`) and a namespace import
marks every export used, so importing `RC_PLAIN` from `read.generated.ts`
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


**A `.slang` that fails to compile leaves its `.generated.ts` untouched**, so `tsc`
and jest pass off the stale module. Grep the emitted WGSL for what you just wrote.
The likeliest cause: a pass naming a packed color uniform must `import
colorPack;` itself, since Slang does not re-export through an import.

## Bumping `SLANG_VERSION`

```sh
pnpm gen:shaders && git diff --stat -- '**/*.generated.ts'   # read the diff
pnpm check-shader-oracle                                     # the real gate
pnpm test --testPathPatterns 'Parity\.test\.ts$'
```

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
- **`lerp` and `step` cannot be refereed.** slangc lowers them differently for
  `-target cpp` than the GPU runs. The `mix` twin follows WGSL; `step` differs only
  on NaN, where the WGSL spec has been published with both phrasings (gpuweb#4527),
  so the twin follows C++ and a test pins it.

## Verified facts

- **A parity test can pass against the very form it rejects.** `_mix` is WGSL's
  `a*(1-t) + b*t` because only that returns `b` exactly at `t == 1`; a test at
  `(0.1, 0.3, 1)` passes both forms. When a test's point is that two formulations
  differ, *run* the rejected one and watch the test fail.
- **Slang DCEs anything no entry point reaches.** For a module the wrapper is the
  only way to get WGSL; for a shader with entry points an exported function must be
  called from the draw path.
- **Integer signedness is tracked and refused-on-doubt.** Don't simplify it away:
  packed ABGR colors and flag words sit at or above 2³¹ where JS's signed coercion
  silently changes the answer.

## The shape library

<!-- SHADER_SHAPE_CONSUMERS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Module | Importers | Imported by |
| --- | --- | --- |
| `antialias` | 18 | _most of the tree_ |
| `barMark` | 0 | — |
| `capsule` | 4 | `alignments/linkedReadLine`, `dotplot-view/dotplot`, `render-core/lineCenterMark`, `wiggle/wiggleLineCenter` |
| `clipStrip` | 3 | `render-core/barMark`, `render-core/coverageClip`, `wiggle/wiggle` |
| `colorPack` | 39 | _most of the tree_ |
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
| `hpmath` | 50 | _most of the tree_ |
| `insertionGlyph` | 2 | `alignments/insertion`, `render-core/insertionMark` |
| `lineCenterMark` | 0 | — |
| `lineCommon` | 2 | `render-core/lineCenterMark`, `render-core/lineStepMark` |
| `lineStepMark` | 0 | — |
| `linkMark` | 0 | — |
| `markColor` | 7 | `render-core/barMark`, `render-core/lineCenterMark`, `render-core/lineCommon`, `render-core/lineStepMark`, `render-core/linkMark`, `render-core/pointMark`, `render-core/spanMark` |
| `pointGlyph` | 2 | `render-core/pointMark`, `wiggle/wiggle` |
| `pointMark` | 0 | — |
| `rowRect` | 3 | `render-core/spanMark`, `sequence/sequenceCell`, `wiggle/wiggleDensity` |
| `rowTable` | 7 | `render-core/barMark`, `render-core/insertionMark`, `render-core/lineCenterMark`, `render-core/lineStepMark`, `render-core/linkMark`, `render-core/pointMark`, `render-core/spanMark` |
| `scoreScale` | 11 | `hic/hic`, `render-core/clipStrip`, `render-core/coverageBand`, `render-core/lineCommon`, `render-core/linkMark`, `render-core/markColor`, `render-core/valueScale`, `variants/ldUniforms`, `wiggle/wiggle`, `wiggle/wiggleCommon`, `wiggle/wiggleDensity` |
| `spanMark` | 0 | — |
| `valueScale` | 7 | `render-core/barMark`, `render-core/lineCenterMark`, `render-core/lineCommon`, `render-core/lineStepMark`, `render-core/linkMark`, `render-core/pointMark`, `wiggle/wiggleCommon` |

<!-- SHADER_SHAPE_CONSUMERS END -->


### The cap split: a frame is cap-agnostic, a distance is not

Round caps serve dotplot (the width slider modulates line to dot, and **the dot IS
the degenerate round cap**) and the wiggle `linecenter` and render-core
`lineCenterMark` capsules (consecutive capsules share a cap at the joint, so the
max-blend pass unions them seamlessly at any angle; square caps nick sharp bends).
Butt caps serve alignments `linkedReadLine` and render-core `linkMark` under `line`,
because their Canvas2D/SVG twins stroke butt: inking round caps on a read connector
diverges from the other two backends.

### The pad is the other half of every coverage

The quad the vertex stage emits and the ramp the fragment stage shades must be
sized from one number. **Pad one without the other and the ramp is clipped at the
quad edge, silently**: coverage falls to 0.5 at the geometry boundary and the
rasterizer cuts it to 0, giving a hard 50%-alpha edge and a line narrower than
`lineWidth`.

### Unifying a constant strands its mirrors

**Unifying a constant strands its mirrors.** A test that models a shader's
   constant copies the value, and a copy checked against itself agrees with itself.
   Grep for the **old literal** (mirrors spell the value, never the symbol), then
   make the survivor importable (`//! export-consts`).

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

