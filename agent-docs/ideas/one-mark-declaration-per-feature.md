---
name: one-mark-declaration-per-feature
description: A feature is written three times — packGpu, drawCanvas, hitTest — across 3,335 lines in plugins/alignments alone, and nothing gated draw against hit test the way CI gates GPU against Canvas2D. features/mark.ts is the generalization of arcs/mark.ts, five features are converted and writing one mark's alpha down found a live GPU/Canvas2D bug; what the shape needed, where it stops (insertion, coverage), and the two things it must not do.
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

**Five features are converted.** The sections below are the proposal as written;
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

## Status, 2026-08-23: five features converted, `features/mark.ts` is the shape

`plugins/alignments/src/features/mark.ts` is the generalization — `PileupMark`
plus `paintMarks`, `findMarkAt` and `countMarks`, with `arcs/mark.ts` left where
it is (the arc band is a different coordinate frame and a path rather than a
rect; nothing was gained by forcing them together).

| feature | shape | consumers | trio, code lines | after, incl. declaration |
| --- | --- | --- | --- | --- |
| `gap` | `span` | pack, draw, hit | 190 | 165 |
| `mismatch` | `cell` | pack, draw, hit | 133 | 120 |
| `perBaseQuality` | `cell` | pack, draw | 67 | 77 |
| `perBaseLetter` | `cell` | pack, draw | 70 | 80 |
| `softclipBases` | `cell` | pack, draw, hit | 105 | 100 |

**The three cell walls are roughly LOC-neutral, and that is the honest result.**
Their packers and painters were already thin; what the conversion buys there is
the pivot shared with `mismatch` rather than restated three more times, and the
two gates written down. Read the table as "the walk stopped being copied", not
as a line count.

Every `.slang` is untouched, and each mark READS the generated scalar twins
(`intronAlpha`, `sizeAlpha`, `frequencyFadeGate`, `qualityFade`) rather than
replacing them — adr-051 is not weakened by any of this.

**Writing `alpha` down as a member found a live GPU/Canvas2D bug**, which is the
strongest argument for the shape so far. `perBaseLetter` borrows mismatch.slang,
which multiplies a frequency fade by a quality fade over whatever the instance
carries; its packer set `frequency = 1` and left `qual` at the buffer's zero. To
that shader a zero is Phred 0 — the worst score a file can hold — so
`qualityFade` sent it to alpha 0 and `vs_main` discarded the vertex: with the
advanced "fade by base quality" setting on, the GPU drew NOTHING for that colour
mode while Canvas2D and the SVG export drew every base opaque. Neither backend
looks wrong alone, and the cross-backend gate would need a suite that turns on a
colour mode and an advanced fade together. The mark forces the question, because
`alpha: () => 1` is a claim each backend then has to meet
(`perBaseLetter/markParity.test.ts` fails on it before the fix).

**The oracle held.** `coverageParity`, `qualityFadeParity`, `cellPainterParity`,
`hitTestGateParity` and `hitTestPipeline` all passed unchanged. Two test edits
were needed and both were the tests being wrong: `hitTestPipeline`'s shared
fixture omitted `mismatchYs` (the old hit test read the count off
`mismatchPositions`, so a missing rows array went unnoticed while it was empty),
and one mismatch test asserted a fill at alpha 0 where `paintMarks` now skips the
mark — the same pixels, one `fillRect` fewer, and what the gap painter always
did.

**The draw-against-hit gate now exists**, per feature: `gap`, `mismatch` and
`softclipBases` each sweep the block half a pixel at a time in both orientations
and assert every hit lands inside the rect the painter drew. The claim has to be
**one-directional — everything hittable is drawn** — because the converse is
false on purpose: a mark below the worker's frequency threshold still paints at
the fade's floor while being deliberately inert (`passesFrequencyGate`), and
"fixing" that by keying the hit test off drawn alpha hands clicks back to the
noise the threshold suppresses.

**A layer with no hit test gets the third pairing instead: pack against draw.**
`perBaseQuality` maps the drawn cell's centre back through `bpAtPx` — the
painter's own inverse — and asserts it is the bp the vertex buffer carries, plus
that the two colour tables are one ramp. `perBaseLetter` goes further and
assembles mismatch.slang's `vs_main` alpha from its two generated twins, runs it
over the packed instance and asserts it equals the mark's alpha across both
settings. That is the direction that found the bug above, and it is cheap
wherever a shader's fades are already `//! js-export`ed.

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

`insertion` and `coverage` were both attempted after the cell family and both
stopped deliberately rather than being forced. Between them they name the two
edges of what `PileupMark` is.

**`insertion` wants a fourth shape and three other things with it**, which is
past the point where converting it teaches anything:

- It is a **point on a bp EDGE**, not a span and not a cell. An insertion sits
  *between* two reference bases, so its genomic extent is zero and
  `startBp`/`endBp` do not describe it; its on-screen width comes from
  `insertionBarWidth(length, pxPerBp, featureHeight)`.
- Its **painter is not a rect**. `drawInsertionMarker` (shared with plugin-maf)
  draws a labelled box, a short bar or a 1px mark with serif caps depending on
  size.
- Its **hit rule is a tolerance derived from that drawn width** — `|genomicPos -
  pos| < (rectWidthPx / 2 + 2) * bpPerPx`. Which is the RIGHT relationship, and
  already drift-free; it is simply not containment.
- It **packs and scans a sub-range**, `[0, numInsertions)` of the merged
  interbase array, while `rows` would be the whole array. Every walker here
  bounds its loop by `rows(data).length`.

`clip` wants the same four minus the painter, so **a `point` shape with a width
rule, a tolerance hit and sub-range bounds is one coherent extension serving two
features** — worth doing as a piece of work in its own right, and worth NOT doing
one feature at a time.

**`coverage` is not a pileup mark at all**, and this is the boundary rather than
a gap:

- There is **nothing to pack**. Its GPU pass is render-core's shared
  `COVERAGE_BAR_PASS` and the buffer is packed in the worker
  (`packCoverageBinsForGpu`), uploaded verbatim; the MAF display draws the same
  shader off the same layout.
- There are **no rows and no per-instance arrays on the main thread** — one
  packed buffer, one bar per bin, and the bar's HEIGHT is the datum.
  `bandTop`/`bandHeight` are functions of a pileup row, which the band has none
  of.
- Its **hit test indexes a bin directly** (`basePos - coverageStartPos`) and
  answers a POSITION, not an instance; there is no row scan to share, and the
  SNP-snap on top of it searches a neighbouring-bp window.

So the rule the shape has found is: **`PileupMark` covers per-instance marks laid
out on pileup rows.** A binned histogram over a worker-packed buffer is a
different mechanism, and giving it a `PileupMark` would mean five members that
mean nothing.

The others, unchanged from the first pass:

- **`modification`** — its hit test is a Flatbush nearest-neighbour query with a
  bp tolerance, not containment. It IS a `cell` painter, so it can take the mark
  for its pack and its paint; only the hit test is a different question.
- **`indicator`, `arcs`, `read`** — 153 lines of hit test over 26 of paint, a
  band-local path, and a hand-tuned single glyph respectively.

## Where this sits

**In plugins/alignments, and deliberately not shared wider.** Lifting
`PileupMark` to a second display type was censused and declined 2026-08-29 —
MAF's cells have no per-instance index space (run-merged GPU encode, arithmetic
hit test) and variants resolves everything once in the worker so every consumer
already reads one array set — the member-by-member table is in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) §Rendering and
displays, with the reopen condition.

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
