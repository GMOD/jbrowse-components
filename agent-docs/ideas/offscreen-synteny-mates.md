---
name: offscreen-synteny-mates
description: Showing alignments whose mate lands on a contig the facing view is not displaying, as a stub/box rather than a ribbon. Stages 1 and 2 SHIPPED 2026-08-19 — the worker counts them and the view marks them behind a toggle; what is left is labelling and hit-testing. Read alongside two-axis-synteny-fetch.md, which is the expensive other half and is untouched by this.
---

# Off-screen synteny mates, drawn as something other than a ribbon

**Stages 1 and 2 shipped on 2026-08-19.** `collectOffscreenMates` tallies the
class-A drops per contig and places them on the query axis;
`offscreenMateMenuItems` reports the count and the contigs; `showOffscreenMates`
turns `OffscreenMateOverlay` on, which marks each one as a stub at the top of
the band. Stage 3 (labels) and hit-testing are the remainder, below. The rest of
this file is the case for it and the reasoning the implementation followed —
kept because the *class B* half is still open.

A synteny band draws a ribbon only when **both** ends land on a displayed
region. When peach chr1 is stacked against grape chr1 and a peach locus is
syntenic to grape chr5, there is no ribbon and no marker and no count — the view
is identical to one where that locus is syntenic to nothing.

The proposal is to draw those as a **non-ribbon element**: a box or stub hanging
off the anchor's axis, labelled with the contig the mate is actually on.

## Two classes, and only one of them is expensive

They are usually discussed together and they should not be. The fetch is scoped
to the query axis (v1, the top view) alone, so:

| class | anchor | mate | fetched today? | dropped at |
| --- | --- | --- | --- | --- |
| **A** | in the visible v1 window | contig v2 does not display | **yes** | `v2RefNames.has(mate.refName)` in the decorate loop |
| **B** | contig v1 does not display | in the visible v2 window | no | never requested |

**Class A costs nothing to recover.** The adapter is queried for a v1 region and
returns every alignment anchored there whatever its mate; pairwise adapters
filter the mate by *assembly* (`targetAssemblyName`, for the all-vs-all case) and
never by refName. The features are decoded, `getMate` succeeds, and they are
discarded by the `&& v2RefNames.has(mate.refName)` conjunct — which is doing
legitimate work for the sort-size reduction it was written for, and incidentally
eating this class.

Class B is [two-axis-synteny-fetch](two-axis-synteny-fetch.md), which is a real
architecture change with a real blocker. Nothing here depends on it.

**Which genome is on top therefore decides how much is free**, because v1 is the
query axis. That asymmetry is not small — see the numbers below.

## What it is worth, measured

`demos/grape_peach_cacao`, the MCScan blocks track, whole chromosome on each
axis. 16,865 grape–peach anchor pairs in the file.

**Peach chr1 (`NC_034009.1`) on top, grape chr1 (`NC_081805.1`) below:**

| | anchors |
| --- | --- |
| anchored on visible peach chr1 | 3796 |
| mate on grape chr1 — drawn today | 1029 |
| mate on another grape contig — **dropped, class A** | **2767 (73%)** |

The 2767 are not scatter. Nine grape contigs, three of which carry 86% of them,
and each covers a distinct near-contiguous run of peach chr1:

| grape contig | anchors | peach chr1 span |
| --- | --- | --- |
| `NC_081809.1` | 892 | 0.3–22.3 Mb |
| `NC_081822.1` | 965 | 32.9–45.5 Mb |
| `NC_081808.1` | 512 | 34.8–40.5 Mb |
| `NC_081816.1` | 176 | 45.5–47.8 Mb |

That is the grape gamma paleohexaploidy read off the demo we ship: each peach
segment has ~3 grape counterparts, the view shows whichever one you happened to
stack, and says nothing about the other two. A user concluding "peach chr1 is
mostly not syntenic to grape" from this view is reading it correctly and getting
the wrong answer.

**The reverse stacking is a different dataset.** Grape chr1 on top: 1103 anchors,
only 74 (7%) with a peach mate off peach chr1. Grape chr1 is one ancestral block
where peach chr1 is a fusion, so the class A payoff here is an order of magnitude
smaller — and the 2767 above become class B, which is not free. **Do not quote a
single percentage for this feature; it is a property of the stacking.**

Reproduce with the three demo files (`grape.blocks.gz`, `grape.bed.gz`,
`peach.bed.gz`); blocks columns are `blockAssemblies` order, so grape is column 0
and peach column 1, joined to coordinates through the BEDs.

## Staging, cheapest first

**1. Say the number.** No geometry at all: count the class A drops per off-screen
mate contig in the decorate loop, return the tally alongside `featureData`, and
show it in the track's UI — "2,767 alignments here map to 9 other grape contigs".
This converts a silent 73% omission into something a user can see, and it is the
only stage with no rendering question in it. It also gives the row-launching
machinery (`syntenyTrackRows`, `connectedEndpoints`) an obvious hook: those
contig names are exactly the rows worth offering to add.

**2. Draw the stub.** Harder than it looks, and the reason to stage it. **Taken
via the overlay**, which is the alternative priced two paragraphs down —
`OffscreenMateOverlay` is a second 2D canvas over the level's, `pointerEvents:
none`, and the shader is untouched. The level's own canvas belongs to the
rendering backend and may be a WebGPU surface, so there is no drawing on it
afterwards; a stacked canvas is what a non-instance element costs. The
shader takes four cumBp corners and interpolates vertically over `u.height`
(`y = u.height * yCurve(t)`), so every instance spans the full gap between the two
axes by construction. A stub that descends only part way is a new kind with a
per-kind vertical clamp — contained, but it is a `.slang` change plus its
Canvas2D counterpart in `syntenyRibbonPath.ts`, and the two must agree or the
fallback path disagrees with WebGPU. Do **not** approximate it by emitting a
degenerate ribbon with the bottom corners equal to the top: that draws a
full-height vertical band, which reads as an alignment to the locus directly
below it — the one thing it must not say.

The alternative, worth pricing before committing to the shader: draw stage 2 as a
separate Canvas2D overlay layer rather than as synteny instances, since these
never need the pick index, the CIGAR tiling, or alpha compositing against
ribbons. 2767 boxes is nothing for Canvas2D and it keeps a visually distinct
element out of the instance format.

**3. Label it.** Needs text, which the instance renderer has none of, so this is
the overlay path whatever stage 2 chose. Probably only at low instance counts.

## Behind a toggle, decided

Colin, 2026-08-19: pursue this, with a switch to turn it on. Which settles the
question stage 2 would otherwise have raised at review — whether a whole second
class of element appearing in every synteny view is a change everyone wants —
without settling it the expensive way, and it gives stage 1's count somewhere
obvious to lead: a number that says how much is being hidden is also the control
that shows it.

Default off is not implied by that and is not obvious. 73% of peach chr1's
anchors on a demo we ship argues the other way, and a feature nobody finds
reports nothing.

## What has to be decided before stage 2

- **Which axis owns a stub.** Settled for class A: `offscreenMateStubs` reads
  `views[level]`, the level's upper row, and its test says why — the lower row's
  ruler puts every stub at a believable wrong offset. If class B ever lands, its
  stubs hang off v2 and the two must be distinguishable from each other and from
  a ribbon whose far end is merely panned off the left/right edge (which already
  draws correctly and is *not* this).
- **Whether stubs obey `minAlignmentLength`.** Open. They carry an alignment
  length and it means the same thing, so probably yes; today they do not, and a
  sub-pixel one is floored to a visible tick instead.
- **What happens on hover/click.** Open, and the piece with the most left in it.
  These have real feature ids and a real mate locus, so
  `SyntenyResolveMatchingRegion` already answers "where does this go" — which
  makes "click to add that contig as a row" natural and cheap. The overlay
  deliberately does not hit-test; that belongs in the level's own pick engine,
  not a second hit path.
- **The lanes needed for both are already shipped.** `mateRefNameIds` indexes
  `mateRefNameDict` per placed stub, so the contig a stub points at is in hand
  and nothing reads it yet — it is there for the label and the click.

## Cheaper thing this is not

Panning the facing view so the mate comes on screen is not the same feature and
does not compete with it: the mate contig has to already be a displayed region
for that, and the case here is precisely that it is not.
