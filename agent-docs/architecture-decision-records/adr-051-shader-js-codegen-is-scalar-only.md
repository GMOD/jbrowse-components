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

- **A synthesized compute wrapper.** Slang eliminates code no entry point
  reaches, so asking for a module's WGSL directly yields nothing. The driver
  generates a throwaway `[shader("compute")]` entry calling each exported
  function, compiles that, and lifts the bodies.
- **Shaders factor the px-space decision out of the clip-space conversion.**
  `snapBoxCenterY` became `yPxToClipY(snapBoxCenterYPx(...))`;
  `extendToMinWidthX` became a unit conversion over `extendToMinWidthPx`. The
  shader API is unchanged, and the *decision* is now exportable. Any future
  shared decision should be authored in this shape.

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

### Deliberately not exported

Being already-scalar is necessary, not sufficient — there has to be a consumer,
and the two implementations have to be *meant* to agree:

- **`discExpand` (pointGlyph)** — expands a quad so a fragment AA ramp isn't
  clipped. Canvas2D draws `ctx.arc` and has no quad; there is nothing to share.
- **`normalizeScore` / `scoreToY` (wiggle)** — the shader's own comment records a
  deliberate divergence from JS `makeScoreNormalizer` on a degenerate
  (`min == max`) domain: JS returns 0, the shader avoids NaN. Unifying them is a
  product decision, not a codegen one. (`wiggle.slang` is also not a module, so
  `js-export` does not reach it yet — see below.)
- **`sBlend` / `yCurve` (synteny)** — exported as a **test oracle**, not as
  production code. The Canvas2D path deliberately draws one `bezierCurveTo`
  rather than tessellating, and `syntenyRibbonPath.ts` carries an algebraic proof
  that the two are identical. `syntenyShaderParity.test.ts` now checks that
  algebra numerically instead of trusting the comment. The bezier is the better
  implementation; sharing the formula would make it worse.
- **`textWidth`, `getGeno`, `getWord`** — no Canvas2D counterpart exists.

## Consequences

- Six drift sites retired across four plugins; `SYNC:`-tagged sites went 27 → 26
  (the synteny `shadeFill` mirror remains, and needs vector support).
- **`js-export` currently only reaches `module` files.** A shader with entry
  points can't be `import`ed by the synthesized wrapper. The fix is small — lift
  from the WGSL `compileOne` already produces — and is what wiggle would need.
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
  Extending the subset to vectors would reach the color/alpha functions
  (`frequencyFade`, `intronAlpha`, `mapHicCount`, `unpackRGBA`, synteny's
  `shadeFill`) — the largest remaining cluster — and is the natural next step.
  Reducing canvas LOC generally is a *different* job: keep promoting recurring
  loop pieces into `canvas2dUtils.ts`, as `forEachClippedBlock` / `fillBpSpan` /
  `makeCellLeftMapper` already were.
