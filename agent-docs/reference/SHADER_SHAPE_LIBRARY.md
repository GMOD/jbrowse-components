---
name: shader-shape-library
description: The shared `.slang` shape modules in render-core — what each one draws, who imports it, and the two splits that keep them from becoming a framework: a cap-agnostic frame shared where the cap is not, and one named coverage per cap style rather than a cap-style flag. Read before adding a shape module, before pointing a second consumer at an existing one, or when a shader comment claims something is shared.
audience: internal
---

# The shader shape library

`packages/render-core/src/shaders/` holds two different kinds of thing, and
conflating them is how a shape library becomes a framework.

- **Atoms** — `hpmath`, `antialias`, `colorPack`, `colorRampLut`, `scoreScale`.
  Arithmetic every shader needs. No geometry, no opinion about what is being
  drawn.
- **Shapes** — `capsule`, `rowRect`, `pointGlyph`, `diagonalGrid`. A mark's
  geometry, shared by the displays that draw the same mark.
- **One pass set** — `coverageBand` plus its five entry points. Not a shape:
  see [GPU_RENDERING.md](GPU_RENDERING.md) §Shaders, which owns that
  distinction and the file-layout rules.

[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
is the admission test and it has not moved: **two real consumers and
non-obvious math**, not surface similarity. A quad is not non-obvious. A
signed-distance field with an antialias contract is.

## What each shape draws, and who draws it

| Shape | The mark | Importers |
| --- | --- | --- |
| `capsule` | a stroked segment with round caps; degenerate → a dot | `dotplot`, `wiggleLine` (full), `linkedReadLine` (frame only) |
| `rowRect` | a colored row rectangle in a banded row | `maf`, `multiRow` (canvas), `wiggleDensity` |
| `pointGlyph` | a scatter disc, and its crisp-square fallback when small | `manhattan` (gwas), `wiggle` (scatter) |
| `diagonalGrid` | the 45°-rotated cell transform | `hic`, `ldUniforms` (variants) |

Re-derive that table rather than trusting it —
`grep -rn "import <name>;" --include="*.slang" plugins packages` is the whole
method, and `SHADER_LIFT_INVENTORY.md` reports the JS-lift side separately.

## The cap split: a frame is cap-agnostic, a coverage is not

`capsule` is the shape that made this explicit, because its four consumers do
not agree about caps and **must not be made to**.

A stroked segment is two decisions, and only one of them carries a cap:

- **The frame** — orient the segment, get a tangent and a normal, survive a
  zero-length delta without a 0/0. `capsuleFrame`. Carries no cap at all.
- **The coverage** — how far past the ink the antialias ramp reaches, and what
  shape the ends are. This is the cap.

So the frame is shared wider than the coverage:

| Consumer | Frame | Coverage | Why |
| --- | --- | --- | --- |
| dotplot | `capsuleFrame` | `capsuleCoverage` (round) | the width slider modulates line↔dot, and **the dot IS the degenerate round cap** — a segment shorter than its width grows isotropically |
| wiggle `linecenter` | `capsuleFrame` | `capsuleCoverage` (round) | consecutive capsules share a cap centred on the joint vertex, so the max-blend pass unions them into a seamless join at any angle; square caps left nicks on sharp bends |
| alignments `linkedReadLine` | `capsuleFrame` | `buttSegmentCoverage` (butt) | its Canvas2D/SVG twin strokes `moveTo`/`lineTo` with the default `lineCap` |
| alignments `arcFlat` | none — its segment is horizontal by construction, so it adds `local` to a centre | `buttSegmentCoverage` (butt) | same twin |

**Round caps are not a style choice here.** Both round-capped consumers need
the cap for a mechanical reason, stated above. Neither reason applies to a read
connector, whose other two backends draw butt caps — so inking round ones there
is a divergence no other backend draws, which is exactly what alignments did
until 2026-08-29 under comments calling it butt-capped.

### Why there is no `capStyle` parameter

A cap-style flag is the obvious factoring and it is refused. Two named coverage
entry points, each in the home of the consumers that want it:

- `capsuleCoverage` in `capsule.slang` — round, two consumers.
- `buttSegmentCoverage` in `alignmentsUniforms.slang` — butt, two consumers,
  a separable box-filter product of two `strokeCoverage` calls so the ends are
  exactly as soft as the sides.

This is the `rampColor` / `rampColorPremultiplied` pattern: two names beat one
name plus a mode, because a mode is a thing every future caller has to decide
and every reader has to trace. `buttSegmentCoverage.test.ts` pins both halves —
the numeric cut (one CSS px past the end, the capsule paints in full and the
butt form paints zero) and the wiring (each pass's generated WGSL *and* GLSL
calls it and names no round-cap distance).

## The pad is the other half of every coverage

A shape that antialiases has two halves that must be sized from one number: the
quad the vertex stage emits, and the ramp the fragment stage shades. **Pad one
without the other and the ramp is clipped at the quad edge, silently** —
coverage falls to 0.5 at the geometry boundary and the rasterizer cuts it to 0,
giving a hard 50%-alpha edge on the diagonals and a line narrower than
`lineWidth` asked for.

`capsuleQuadLocal` grows the quad by exactly `capsuleCoverage`'s reach.
`segmentQuadLocal` does the same for the butt form. The pad tests
(`dotplotCapsulePad.test.ts`, `syntenyFillPad.test.ts`) are the gate, and
[GPU_RENDERING.md](GPU_RENDERING.md) §"Antialiasing ramps" owns the ramp-width
rules those tests encode.

## What is deliberately NOT shared

Sharing more is not better, and each of these is a decision with a reason:

- **`arc.slang`'s tangent guard** looks like `capsuleFrame` and is not: it
  normalizes a parametric curve's derivative, not a segment delta, and keeps
  its own `1e-3`. Normalizing a vector with a fallback is obvious math — the
  ADR-040 bar excludes it on its own.
- **A colour payload.** Every shape stops at geometry. Where a `float3` looked
  shareable, ADR-051's answer is to split the scalar decision out and leave the
  conversion per-backend; the whole table of candidates that failed that test
  is in that ADR.
- **The band allocators.**
  [mechanisms/feature-band-consumers](../mechanisms/feature-band-consumers.md)
  declined generalizing them, correctly — `computeBandStack` is five lines and
  sticky coverage and scrolling sections differ where they should.

## Two ways this goes wrong quietly

Both happened in one week, both passed every gate:

1. **A comment claims sharing that is not happening.** `capsule.slang` said the
   cap-agnostic frame was shared with the butt-capped strokes while
   `linkedReadLine` still spelled its own copy; before that, the alignments
   coverage was inking round caps under comments calling it butt-capped. A
   sharing claim is testable — assert the generated WGSL and GLSL actually call
   the shared function — and untested prose about cross-module structure is
   where this hides.
2. **Unifying a constant strands its mirrors.** Collapsing the degenerate guard
   `1e-3`/`1e-4`/`1e-4` into `CAPSULE_MIN_LEN_PX` left
   `dotplotCapsulePad.test.ts` modelling `len > 0.001` under a "SYNC: keep in
   step" comment — still green, because a copy checked against itself agrees
   with itself. After unifying a constant, grep the tree for the **old
   literal**; the mirrors spell the value, never the symbol. The fix is to make
   the survivor importable (`//! export-consts`) so the next unification cannot
   strand it.

A test that models a shader must import every scalar it can and model only what
the emitter genuinely refuses — a `float2` signature, a struct return. See
[SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) for what is liftable and
`SHADER_LIFT_INVENTORY.md` for what currently is.

## Adding a shape, or a consumer

1. **Two real consumers first.** One consumer is a display-local shader; the
   module can move later, and ADR-040 exists because it was proposed the other
   way round.
2. **Take the frame and the coverage as separate questions.** A new consumer
   may want one and not the other — that is the normal case, not a special one.
3. **Never add a mode flag to serve the second consumer.** Two named functions.
4. **State the pad and the ramp together**, in one comment, in the module that
   owns both.
5. **Run `pnpm gen:shaders` and check `git status` is clean**, not just its
   exit code: the Imported-by column of the Exports table in
   [SHADER_LIFT_INVENTORY.md](SHADER_LIFT_INVENTORY.md) moves when a consumer
   or a test starts importing a generated twin, and `autogen --check` does not
   cover that file.
