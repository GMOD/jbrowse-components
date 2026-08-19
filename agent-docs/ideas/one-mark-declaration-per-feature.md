---
name: one-mark-declaration-per-feature
description: A feature is written three times — packGpu, drawCanvas, hitTest — across 3,335 lines in plugins/alignments alone, and nothing gates draw against hit test the way CI gates GPU against Canvas2D. arcs/mark.ts is the abstraction for exactly one feature; what generalizing it looks like, and the two things it must not do.
---

# A feature declares its mark once

`plugins/alignments/src/features/` holds 20 feature directories, and each writes
the same walk over the same per-feature arrays three times:

| file | count | lines |
| --- | --- | --- |
| `packGpu.ts` | 18 | 773 |
| `drawCanvas.ts` | 18 | 1460 |
| `hitTest.ts` | 10 | 1102 |

3,335 lines. What a feature actually contains is one array schema, one selection
predicate, one visibility gate and one shape — written out three times.

**The abstraction already exists, for exactly one feature.**
`plugins/alignments/src/features/arcs/mark.ts` is it. Read its header before
anything else here: it records two drift bugs (`98dd82120b` split the dome's Y
and updated two of three consumers; the hit test diverged from the paint one
commit earlier) and states the conclusion this generalizes — *two instances of
one shape is a missing function, not two bugs.* Its consumers are named there:
the Canvas2D/SVG stroke, the hover highlight path, the hit test, the debug
overlay.

## `gap` is the smallest complete triple, and the one to read

All three files walk `(gapPositions, gapYs, gapTypes, gapFrequencies)`, all
three filter on `gapTypes[i] === kind`, and all three apply one visibility gate.
`drawCanvas.ts` calls its copy "Twin of gap.slang's deletion branch".
`hitTest.ts` carries a paragraph explaining that its gate had to be *added*,
because without it a deletion the worker had zeroed went on intercepting every
click across its span — and notes `hitTestClip` was fixed for the same reason.

## What holds the copies together today, and what does not

`GPU_RENDERING.md` §"Keeping the two backends in parity" lists four mechanisms
plus the `SYNC:` fallback, and
[reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) is the CI
gate. Every one of them is about GPU ↔ Canvas2D. **Nothing covers draw ↔ hit
test**, which is why that third copy's drift shows up as comments rather than as
a failing gate.

## The shape

A feature declares its mark once — arrays, predicate, gate, shape. The packer
and the hit test derive from the declaration. The Canvas2D painter comes from a
shape library of roughly ten marks (span rect, row rect, line/segment, point
glyph, capsule, triangle/indicator, chevron, diagonal cell, bezier/dome, text)
rather than from 18 feature directories. That library has already started
forming and its first three entries are in tree:
`packages/render-core/src/shaders/{pointGlyph,rowRect,diagonalGrid}.slang`, two
consumers each, admitted on the
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
bar.

## Two things it must not do

Both are settled, and both are easy to get wrong on a first attempt.

- **It does not transpile a vertex or fragment stage.**
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  is right and stands; the shader stays hand-written, per *shape* rather than
  per feature.
- **It does not erase the intentional backend divergences.**
  `WIGGLE_FUDGE_FACTOR`, the variant-matrix `f2` and synteny's
  stroke-vs-fill swap are per-backend AA compensation, enumerated in
  `GPU_RENDERING.md` under "Intentional divergences". The load-bearing
  observation is that **each of them is a property of the shape, not of the
  feature** — which is what makes ten homes for them correct where 18 would not
  be.

## Oracle: it already exists

`coverageParity.test.ts`, `flatPaintOrder.test.ts`,
`crossRegionFlatParity.test.ts`, `qualityFadeParity.test.ts` and the rest of the
per-feature parity suite pin the current behavior. Convert one feature, run them
unchanged. Most of them should become structurally unnecessary afterwards, which
is the result rather than a side effect.

## Where this sits

Last of three render-path simplifications, and incrementally — one alignments
feature at a time behind the parity suite, because it is the one that touches 46
files. Take [one-upload-model-not-four](one-upload-model-not-four.md) first and
[absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md)
second.

It also upgrades the claim the architecture can make, from "we single-source
shaders across two GPU APIs" — a toolchain claim — to "a display declares its
marks once; the GPU pass, the Canvas2D and SVG painters, and the hit test all
derive from that declaration", which is a claim about the architecture. The
strategy table's fourth row, *one display, one drawing definition*, holds
nowhere until this lands.

## Already declined nearby — do not re-derive

**Render graph, indirect draws, SSBOs, GPU-driven culling** are all in
`GPU_RENDERING.md` §"What this architecture deliberately does not have", with
one specific reason each. None of them is what this is.
