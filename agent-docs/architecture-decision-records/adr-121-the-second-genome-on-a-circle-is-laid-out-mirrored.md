---
status: Accepted
summary: "A two-genome circle reorders its second genome with the same `diagonalizeRegions` the synteny row and the dotplot use, then lays that answer out MIRRORED — regions in reverse order, each region reversed — because both arcs of a circle run the same way round and the linear answer therefore sends every matching pair to a pair of antipodal points. Chords between two arcs never cross when one side's coordinate rises with the angle and the other's falls, so the mirror is what turns the hairball into a band. `reversed` becomes real on the circle for the first time: `bpToRadians` reads it, `ribbonEndRadians` answers its two angles in GENOMIC order rather than sorted, and a ring's strip block carries it into the projection every linear display already honours. Two things landed with it, both visible on the same figure: an alignment reached from both genomes now draws one ribbon instead of two, and the ribbon default is one flat translucent fill, since the strand is already in the twist"
---

# ADR-121: The second genome on a circle is laid out mirrored

## Status

Accepted (2026-09-10). Builds on
[ADR-116](adr-116-a-synteny-alignment-is-a-ribbon-on-the-circle.md), which put
two genomes on the circle and drew the alignments between them, and on
[ADR-119](adr-119-the-circular-view-is-a-coordinate-stage-over-the-linear-displays.md),
whose ring strip is what carries a reversed region into a quantitative track.

## Context

The human-mouse figure ADR-116 shipped is a hairball. Every ribbon converges on
the middle of the circle and the picture is an interleaved wash of red and blue
with no bundle a reader can follow.

Three separate causes, all visible in one frame.

**The layout.** hg38 takes the first arc and mm39 the next, and both run
clockwise. So a human chromosome at fraction _u_ of its arc and the mouse
chromosome it aligns to at fraction _u_ of the other sit at angles that differ by
half a turn — antipodal. Every ribbon in a perfect 1:1 alignment is then a
diameter, and every diameter passes through the centre. The chromosome ORDER
being arbitrary on top of that only decides which diameter.

**The double draw.** A pairwise file indexes every row from both ends
(`PairwiseIndexedPAFAdapter` picks its `q`/`t` prefix from the queried
assembly), and a two-assembly circle asks for the displayed regions of both. So
each alignment came back twice — anchored on hg38 with its mate on mm39, and
again the other way round — and the two features draw the same shape. A
translucent fill chosen at one alpha painted at two.

**The colour.** The default was the linear displays' strand palette, red forward
and blue reverse. Every mammalian autosome carries inversions, so at
whole-genome scale that is a red ribbon beside a blue one all the way round.

## Decision

### The reorder is the shared one; the mirror is the circle's

`runCircularDiagonalize` is the third caller of `@jbrowse/core`'s
`diagonalizeRegions`, beside the synteny cascade and the dotplot, over the same
`DiagonalizeArgs` and behind its own `DiagonalizeCircular` RPC —
`plugins/circular-view/src/DiagonalizeCircularRpc.ts`, three lines like the other
two, registered separately because a method is only callable if the plugin
registering it is loaded and circular-view ships in products carrying neither of
the others. `autoDiagonalize` is the launch key and **Re-order chromosomes** the
menu item, both spelled as the comparative views spell them, and the shared
`DiagonalizeProgressMixin`, `withDiagonalizeProgress`, `DiagonalizeDialog` and
`DiagonalizeLoadingScreen` drive the wait, the bar, the cancel and the gate.

**What the circle adds is `mirrorRegionsForCircle`**: reverse the region order and
flip each region's `reversed`. Chords from one arc to another never cross when one
side's coordinate rises with the angle and the other's falls, which is the whole
of it — a laminar family instead of a pencil through the centre. `diagonalizeRegions`
answers for a linear panel, where both axes run the same way, so its answer is
mirrored on the way out.

**And mirrored back on the way in.** The regions handed to the algorithm are the
circle's, un-mirrored, so the "before" it measures its `regionsReordered` and
`regionsReversed` against is the same space its answer is in. The mirror is an
involution, so this makes the pass idempotent: re-running it on a diagonalized
circle reports that it moved nothing. Without the undo, every run reported every
chromosome flipped, and flipped them.

Exactly two assemblies. One is a self-alignment, with no second arc to reorder;
three or more have no layout in which every pair reads as a band, so the circle
declines rather than picking one pair's answer and calling it the figure.
`canDiagonalize` is that test, and it also gates the menu item.

### `reversed` becomes real on the circle

A mirrored region is a reversed region, and nothing on the circle read the flag
before.

- `bpToRadians` runs a reversed region from its slice's END angle, so its first
  base is at the larger angle.
- **`ribbonEndRadians` answers a side's two angles in GENOMIC order**, `start`
  first even when that is the larger. It used to sort them low-to-high, which is
  identical on an unreversed slice and wrong on a mirrored one: a forward
  alignment into a mirrored arc drew untwisted where it should twist relative to
  the arc's own direction, and an inversion drew as if it were forward. That one
  change is what makes `ribbonAngles` need no mirror case at all — it was always
  a statement about genomic ends.
- `stripBlocks` hands the ring's content block `reversed`, and every linear
  display's projection already honours it (`blockClipUtils`), so a density ring
  over a mirrored arc reads the same way round as the ideogram under it. The
  strip's `bpToPx`/`pxToBp` pivot with it.

### One ribbon per alignment

`dedupeRibbons`, in the display's fetch commit, keys on the **unordered pair of
loci** — which is what a ribbon is, two spans with no anchor between them. The
one thing separating it from the adapter's own `createSideDedupe` is exactly
that: the adapter keys on the ORIENTED alignment, so that the two ends of a
tandem duplication each keep their own half in a linear view. On the circle those
two halves are one arc.

The surviving feature is the one anchored on the first arc's genome, since the
circle lists that genome's regions first — which is also the id a figure spec
anchors by.

### One flat translucent fill

`rgba(70,130,180,0.25)`, a literal in the config schema so the eagerly-built
schema still pulls none of synteny-core in with it. **The strand is already in
the geometry** — a reverse alignment twists between its two ends, which is
ADR-116's decision and the reason a ribbon beats a chord — so a per-strand
palette spends the figure's whole colour budget restating the shape. The strand
jexl is two lines in the schema's own `#example` for anyone who wants it.

## Alternatives rejected

- **Mirroring the second genome at layout time, always, with no alignment
  data.** Free, and it does remove the pencil through the centre on its own. But
  the bundles stay long and crossing, because which mouse chromosome faces which
  human one is still arbitrary — the ordering is the other half of the answer.
  It also silently reverses a genome the session author laid out, in a list they
  can read; the reorder writes its answer into `displayedRegions` where they can
  see and undo it.
- **A per-assembly layout direction on the view.** A second vocabulary for what
  `reversed` on a region already says, and the linear synteny diagonalize
  already writes exactly that field. One mechanism.
- **Reusing `DiagonalizeSynteny`.** It is registered by
  `linear-comparative-view`, which a product carrying the circular view need not
  load. `runDiagonalize`'s own docstring says why each caller registers its own
  name.
- **Colouring the ribbons by chromosome** (the Circos convention, and what
  `colorBy: 'query'` does in a linear synteny view). It reads well and it is the
  obvious next step, but it is a `colorBy` machine the SVG ribbons do not have:
  synteny-core's colour functions answer packed ABGR for a GPU renderer, and the
  circular displays' colour is a `jexl:` config slot. Flat first, since flat is
  what the figure needed; the palette is a display-model `colorBy` when someone
  wants it.
- **Diagonalizing three or more genomes as a cascade**, each against the one
  before it, as the synteny stack does. The stack's rows are parallel, so a
  cascade converges; three arcs of a circle have no direction assignment that
  makes all three pairs laminar, so the pass would improve one pair and be
  silent about which.
- **A cue on the ideogram for a mirrored arc** — an arrowhead, or `[rev]` on the
  label. A circular ruler draws no coordinates, so nothing on screen says which
  way a chromosome runs. Threading it into `regionLabelText` reaches the padding
  reservation and the SVG export's gutter measurement, the same wall ADR-116
  hit disambiguating two genomes' identical `chr1` labels, and it belongs with
  whatever else that pair of labels needs. The tutorial and the user guide say
  it instead.

## Consequences

- The ribbon fetch is halved on a two-genome circle, since half of what it drew
  was the same alignment twice.
- `ChordSyntenyDisplay.ready` folds in the view's `pendingAutoDiagonalize`, so
  the display publishes `data-display-drawn=false` and refuses an SVG export
  while a reorder this launch asked for has not resolved. A reorder that THREW
  leaves it up, which is the policy the comparative views already state: a
  capture times out loudly rather than committing a hairball.
- `CircularView.showLoading` folds in `awaitingAutoDiagonalize`, which is what
  `AppReadyMarker` reads, so `[data-app-phase="ready"]` waits for the reorder.
- Every figure of the human-mouse circle was recaptured, and the tutorial gained
  its own section on what the reorder does.
- A hand-written session that puts `reversed: true` on a circular view's region
  now means something. Nothing wrote one before.
