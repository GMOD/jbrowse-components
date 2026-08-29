---
name: one-mark-declaration-per-feature
description: A feature is written three times — packGpu, drawCanvas, hitTest — across 3,335 lines in plugins/alignments alone, and nothing gated draw against hit test the way CI gates GPU against Canvas2D. features/mark.ts is the generalization of arcs/mark.ts, seven features are converted and writing one mark's alpha down found a live GPU/Canvas2D bug; what the three shapes needed, where it stops (coverage, modification's hit test), and the two things it must not do.
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

**Seven of the twenty are converted**, leaving thirteen. The sections below are
the proposal as written;
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

The two `point` conversions below were counted a second way — non-blank,
non-comment lines over the pass's files — because the rule behind the column
above was not recorded and could not be reproduced. Calibrating that rule on the
rows it can still reach gives `gap` 167 → 168 and `mismatch` 120 → 120, so the
two counts disagree on absolute lines and agree on the shape.

| feature | shape | consumers | trio | after, incl. declaration |
| --- | --- | --- | --- | --- |
| `insertion` | `point` | pack, draw, hit | 177 | 184 |
| `clip` | `point` | pack, draw, hit | 173 | 195 |

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

### Status, 2026-08-29: the `point` shape, and what it cost

The paragraph above this one used to say `insertion` wanted a fourth shape "and
three other things with it, which is past the point where converting it teaches
anything", and that `clip` wanted the same minus the painter. Both are converted
now, as one piece rather than one feature at a time, and the prediction was right
about the pieces and wrong about one of them.

`MarkShape` is `span | cell | point`, and `PileupMark` is a union: a `SpanMark`
keeps `endBp`, a `PointMark` has no extent at all and states two members in its
place.

- **`widthPx` is the one that behaved as predicted.** The painter fills a bar
  centred on the bp edge and the GPU sizes its own quad from insertion.slang's
  twin of the same rule, so `paintMarks` draws every point mark with one
  `fillRect`, from the member. `drawInsertionMarker` split into that bar and
  `drawInsertionSerifs` — the caps are insertion's decoration on top of the
  shared glyph, and plugin-maf still gets both composed.
- **`hitToleranceBp` is a second member, not a derivation, and that is a
  measurement.** The doc predicted one rule, "a tolerance derived from drawn
  width". Insertion's is exactly that — `widthPx / 2 + 2 px`, one expression off
  the member the painter draws from. Clip's is `max(0.5 bp, 3 px)`: a floor in
  BP, which no width rule expresses, and deriving it would have narrowed a
  deep-zoom clip's target from 5px to 2.5px. Writing the tolerance down per
  feature keeps insertion's stated as the relationship it is and stops clip's
  from looking like one it isn't.
- **The sub-range bound is `rangeStart`/`rangeEnd` on every mark, not on the
  point.** It is orthogonal to shape — a feature sharing an array could be any of
  the three — and absent means the whole array, so the first five marks are
  untouched. It also reached further than expected: `Canvas2DRegionData` had been
  carrying nine pre-sliced views of the merged interbase array purely so the
  painters would not need the bound, which was that same expression a third time.
  The merged array now travels whole and all three consumers slice it through the
  marks.
- **`alpha` gained `pxPerBp` beside `widthPx`.** A point has no span for a fade
  to measure, and both insertion.slang and clip.slang fade on the zoom itself.

**LOC went UP on both**, +7 and +22 by the count above, and neither the packers
nor the painters were fat to begin with. What the conversion buys is the walk —
the row scan, the off-canvas skip, the projection, the two gates and the
sub-range bound — stopping being copied, plus two gates that did not exist. Read
it the way the cell rows are read.

**The gates are draw-against-hit plus pack-against-draw, in both orientations.**
A point's hit target is deliberately wider than its ink, so the span gate's claim
is not available: what replaces it is "everything hittable is drawn, within the
tolerance the mark declares". Both fixtures hold the other kinds of interbase, so
the swept assertion on `hit.index` is what sees a lost sub-range bound. Seven
sabotages went red — the bound in both directions, both tolerances, the packer's
bp, the packer's kind order, and the centring in `paintMarks`. One stayed green:
changing `widthPx` moves the ink and the tolerance together, which is the member
working rather than the gate failing.

**The oracle held.** `coverageParity`, `hitTestGateParity`, `hitTestPipeline`,
`reversedMirror` and the per-feature suites pass unchanged, and `HIT_GATES` still
files `insertion` under `showMismatches` and `clip` as `alwaysDrawn` — the
conversion changed neither story. `hitTestCigarItem` keeps the whole CIGAR
priority chain, zoom regime included; the marks changed what each step reads, not
which steps there are. Two test edits, both mechanical consequences of a
signature rather than an assertion moving: `perBaseLetter/markParity` passes
`alpha` its fifth argument, and `clip/drawCanvas`'s fixture states the merged
array instead of a pre-sliced one.

One wart, recorded rather than hidden: the insertion packer needs a mark and the
mark needs a `featureHeight` it has no use for, since the shader sizes its own
quad. `INSERTION_PACK_MARK` passes 0 and says so.

### The features that do NOT fit, and why

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

The others:

- **`modification`** — its hit test is a Flatbush nearest-neighbour query with a
  bp tolerance. Containment was the objection, and `point` has since made a bp
  tolerance a shape rather than an exception, so what is actually left is the
  INDEX: the query answers out of Hilbert order and picks by distance, where
  every mark test scans rows backwards. It IS a `cell` painter, so it can still
  take the mark for its pack and its paint.
- **`indicator`, `arcs`, `read`** — 153 lines of hit test over 26 of paint, a
  band-local path, and a hand-tuned single glyph respectively.

**Thirteen of the twenty directories are unconverted.** Two of them
(`sashimi`, `derivativePaths`) are not passes at all — no `packGpu.ts`, React
SVG overlays — and `coverage`, `snpCoverage`, `modCoverage`, `interbase` and
`indicator` are the coverage band, which the boundary above rules out. That
leaves `read`, `overlap`, `connectingLines`, `linkedReads`, `arcs` and
`modification` as the pileup passes still stating their geometry more than once,
and `read` is the one that would decide whether the shape holds at the top.

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
