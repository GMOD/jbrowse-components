---
name: one-mark-declaration-per-feature
description: A feature is written three times — packGpu, drawCanvas, hitTest — across 3,335 lines in plugins/alignments alone, and nothing gated draw against hit test the way CI gates GPU against Canvas2D. features/mark.ts is the generalization of arcs/mark.ts and two features are converted; what the shape turned out to need, what is left, and the two things it must not do.
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

**Two features are converted.** The sections below are the proposal as written;
[what the shape turned out to be](#status-2026-08-23-two-features-converted-featuresmarkts-is-the-shape)
is the status further down, and `plugins/alignments/src/features/mark.ts` is the
code.

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

## Status, 2026-08-23: two features converted, `features/mark.ts` is the shape

`plugins/alignments/src/features/mark.ts` is the generalization — `PileupMark`
plus `paintMarks`, `findMarkAt` and `countMarks`, with `arcs/mark.ts` left where
it is (the arc band is a different coordinate frame and a path rather than a
rect; nothing was gained by forcing them together).

| feature | shape | trio, code lines | after, incl. declaration |
| --- | --- | --- | --- |
| `gap` | `span` | 190 | 165 |
| `mismatch` | `cell` | 133 | 120 |

Both keep their `.slang` untouched, and both READ the generated scalar twins
(`intronAlpha`, `sizeAlpha`, `frequencyFadeGate`, `qualityFade`) rather than
replacing them — adr-051 is not weakened by any of this.

**The oracle held.** `coverageParity`, `qualityFadeParity`, `cellPainterParity`,
`hitTestGateParity` and `hitTestPipeline` all passed unchanged. Two test edits
were needed and both were the tests being wrong: `hitTestPipeline`'s shared
fixture omitted `mismatchYs` (the old hit test read the count off
`mismatchPositions`, so a missing rows array went unnoticed while it was empty),
and one mismatch test asserted a fill at alpha 0 where `paintMarks` now skips the
mark — the same pixels, one `fillRect` fewer, and what the gap painter always
did.

**The draw-against-hit gate now exists**, per feature: `gap/markParity.test.ts`
and `mismatch/markParity.test.ts` sweep the block a quarter-pixel at a time and
assert every hit lands inside the rect the painter drew. The claim has to be
**one-directional — everything hittable is drawn** — because the converse is
false on purpose: a mark below the worker's frequency threshold still paints at
the fade's floor while being deliberately inert (`passesFrequencyGate`), and
"fixing" that by keying the hit test off drawn alpha hands clicks back to the
noise the threshold suppresses.

### What the shape needed that this doc did not predict

- **The pivot is one decision spanning two consumers, not two.** `MarkShape` is
  `span | cell`, and it settles the Canvas2D widening AND the cursor coordinate
  together: `span` widens about the midpoint (`fillSpanRect`, twin of
  `expandMinWidthX`) and contains the fractional `genomicPos`; `cell` floors
  one-sidedly (`makeCellLeftMapper`, matching mismatch.slang's snapped left edge)
  and contains the integer `basePos`. Pairing them wrong is a reversed-block bug
  on exactly one pixel column per base, which is why `bpAtPx` and `bpAtPxExact`
  both exist. The doc's "shape library" is real, but its entries are pivots plus
  bands, not ten painters.
- **Two gates, never one.** Drawn alpha and click significance are separate
  members (`alpha`, `hittable`) and must stay separate — see above.
- **The band is per-instance, not per mark.** A gap is a full-height bar as a
  deletion and a 1px centerline as an intron, off one array and one shader, so
  `bandTop`/`bandHeight` take `(data, index)`.
- **Allocation-free is a hard constraint, so there is no instance object.**
  Every member takes `(data, index)`; `fillSpanRect`'s own note sets that bar and
  these loops run per mark per frame.
- **The selection predicate replaced a kind ARGUMENT, and that was a win.**
  `packGapsOfType(data, 7)` compiled, allocated a zero-length buffer and drew
  nothing. A mark reads the byte instead of being handed one to compare against
  it, so that state is unspellable; the property it guarded (a third gap type is
  packed by neither pass) moved into `selects` and is now a test.

### The features that do NOT fit, and why

Worth knowing before the next conversion, because two of them look adjacent:

- **`modification`** — its hit test is a Flatbush nearest-neighbour query with a
  bp tolerance, not containment. Different question, not a different spelling.
- **`clip`** — a fixed 1px bar centred on a bp EDGE, hit-tested with a
  `max(0.5, 3 * bpPerPx)` tolerance, packed over a sub-range of the shared
  interbase array. Wants a `point` shape, a tolerance hit rule, and sub-range
  scanning: three extensions for one feature.
- **`indicator`, `arcs`, `read`** — 153 lines of hit test over 26 of paint, a
  band-local path, and a hand-tuned single glyph respectively.

The cheap ones left are the rest of the cell family: `perBaseQuality`,
`perBaseLetter` and `softclipBases` are `cell` marks with `contiguous: true`, and
`cellPainterParity.test.ts` already pins all five painters to the one geometry.
`modification` is a cell painter too and can take the mark for its paint and its
pack — only its hit test is a different question.

## Where this sits

Last of the render-path simplifications, and incrementally — one alignments
feature at a time behind the parity suite, because it is the one that touches 46
files. The upload-model collapse ahead of it is done (ADR-078,
ADR-079; the `retainRegion` transaction retired with it, 2026-08-21), and
absolute coordinates for HiC and LD shipped the same day — this is the last
render-path simplification standing.

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
