---
name: offscreen-synteny-mates
description: Showing alignments whose mate lands on a contig the facing view is not displaying, as a mark/box rather than a ribbon. Class A SHIPPED 2026-08-19 — counted, drawn behind a toggle, labelled, named on hover, clickable to show that contig, and carried into an SVG export. Class B shipped the same day behind `bidirectionalFetch` (two-axis-synteny-fetch.md), on the terms this file settled: its marks hang off the target axis and its click navigates the row above.
---

# Off-screen synteny mates, drawn as something other than a ribbon

**Class A shipped on 2026-08-19, all three stages.**
`collectOffscreenMates` tallies the drops per contig and places them on the
query axis; `offscreenMateMenuItems` reports the count and the contigs;
`showOffscreenMates` turns `OffscreenMateOverlay` on, which draws each as a mark
at the top of the band, labelled with the contig it points at; hovering one names
that contig whether or not the run is wide enough to be labelled, and clicking
one shows it on the facing row. An SVG export carries the same marks. The
rest of this file is the case for it and the reasoning the implementation
followed — kept because it is the reasoning class B was then built on, the same
day and to the terms set out at the bottom of this file.

A synteny band draws a ribbon only when **both** ends land on a displayed
region. When peach chr1 is stacked against grape chr1 and a peach locus is
syntenic to grape chr5, there is no ribbon and no marker and no count — the view
is identical to one where that locus is syntenic to nothing.

The proposal is to draw those as a **non-ribbon element**: a box or mark hanging
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

Class B is [two-axis-synteny-fetch](two-axis-synteny-fetch.md), which was
believed to be a real architecture change with a real blocker and turned out to
need neither — see that file. Nothing here depended on it, and what shipped
there is the mirror of what shipped here.

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

**2. Draw the mark.** Harder than it looks, and the reason to stage it. **Taken
via the overlay**, which is the alternative priced two paragraphs down —
`OffscreenMateOverlay` is a second 2D canvas over the level's, `pointerEvents:
none`, and the shader is untouched. The level's own canvas belongs to the
rendering backend and may be a WebGPU surface, so there is no drawing on it
afterwards; a stacked canvas is what a non-instance element costs. The
shader takes four cumBp corners and interpolates vertically over `u.height`
(`y = u.height * yCurve(t)`), so every instance spans the full gap between the two
axes by construction. A mark that descends only part way is a new kind with a
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
the overlay path whatever stage 2 chose. Not gated on a count in the end: a
label goes on wherever it FITS, which is what "too many to label" actually
means, and one label per *stretch* rather than per anchor, since a block is
dozens of anchors a few px apart. Haloed, because the label sits below the mark
over whatever the renderer painted.

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

## What class A settled, and what class B inherits

- **Which axis owns a mark.** Settled for class A: `offscreenMateStrip` reads
  `views[level]`, the level's upper row, and its test says why — the lower row's
  ruler puts every mark at a believable wrong offset. Class B's marks hang off
  v2, and they are told apart by the edge of the band they hang from — the two
  strips are at opposite edges, which is also what lets one hit test answer for
  both. Neither is a ribbon whose far end is merely panned off the left/right
  edge, which already drew correctly and is *not* this.
- **Whether marks obey `minAlignmentLength`.** Settled: yes, on the same
  reasoning the ribbons do. A sub-pixel mark that survives the floor is still
  floored to a visible tick, since a mark carries no width a reader could act
  on.
- **What happens on hover/click.** Settled for the pairwise case, which is the
  one class A produces: the mate contig belongs to the facing row's own
  assembly, it is simply not displayed, so a click navigates that row to it and
  the marks become ribbons. `SyntenyResolveMatchingRegion` was the other
  candidate — it answers "where exactly does this go" — and it is not needed to
  make the contig visible, only to land on the right locus within it. Worth
  revisiting if landing whole-contig turns out too coarse.

  The click is `navToLocString`, which REPLACES the facing row's displayed
  regions — the exact narrowing the follow must never do to itself. Here it is
  the request, not a side effect, and the row's own header undoes it.
- **Where the hit test lives.** In the level's pointer handlers, before the
  ribbon pick, answering only within the mark strip. The overlay stays
  `pointerEvents: none`: two hit paths over one band is how a click comes to
  mean different things depending on which element received it. Draw and hit
  test share `offscreenMateRects`, so they cannot disagree the way the ribbons
  can — `syntenyPickRenderAgreement.test.ts` exists because those are two code
  paths.
- **How a reader identifies an UNLABELLED run.** Settled 2026-08-19: by
  hovering. A name goes on a stretch only when the stretch is wide enough to
  hold it, and on `synteny_offscreen_mates_on` that is 5 of the 17 stretches on
  screen — so the marks a reader most needs explained are the ones the strip
  cannot explain. Until the hover the only way to identify one was to click it,
  and the click runs `navToLocString`, which replaces the facing panel's
  displayed regions: the destructive step was the only way to see what it would
  do. `OffscreenMateTooltip` renders through `ComparativeTooltip`, the same
  tooltip a ribbon hover uses, because a mark and a ribbon are two things in one
  band. Its count comes off the tally the hamburger item reports from, scoped to
  this band rather than the view.
- **Whether the figure carries them.** Settled: yes. `showOffscreenMates` is a
  menu setting, so the same rule the color-by legend follows applies — an export
  taken with it on has to have it, or the figure of a view reporting what it
  cannot draw is the figure that does not draw it. `SVGOffscreenMates` is one
  layer per level, after every display's ribbons and inside the band's clip,
  running the same `drawOffscreenMates` through `PaintLayer`. Class B's marks
  hang off v2, and share the layer rather than getting their own: one strip per
  axis, each positioned against its own row, drawn by the same call with a
  `side`. What must not be shared is the RULER, which is the mistake this
  section opens with.

## What it costs the frame it runs in

<!-- BEGIN GENERATED MEASUREMENT offscreen-mate-overlay -->

|   marks | hover over ribbons | hover, before | hover in the strip | one repaint | SVG export layer |
| ------: | -----------------: | ------------: | -----------------: | ----------: | ---------------: |
|   2,767 |           <0.001ms |       0.034ms |            0.027ms |      0.21ms |            90 KB |
|  50,000 |           <0.001ms |        1.06ms |              0.5ms |      3.08ms |         1.302 MB |
| 250,000 |           <0.001ms |        5.97ms |             2.53ms |  **16.2ms** |         6.624 MB |

<!-- END GENERATED MEASUREMENT offscreen-mate-overlay -->

On the shape this was designed against the overlay is free: a repaint is a fifth
of a millisecond, against the 12.5ms the pick engine's own warm hover costs on an
all-vs-all PAF (`reference/SYNTENY_PICKING.md`).

**The hover is independent of the mark count, and deliberately.** The strip is a
few pixels of a band ~100 tall, so nearly every pointer position `offscreenMateHit`
is asked about is not in it — and it runs ahead of the ribbon pick on every
mousemove. Testing the strip height before any alignment is what collapses that
column; laying the level out first to answer "no" is what the `hover, before`
column is, and at 250k marks it was 6ms of every frame the pointer moved.

**The strip is one path, not a fill per mark.** The mark color carries alpha, so
filling each separately composites them against each other and the strip darkens
with density — at whole-chromosome zoom there are more marks than pixels, so it
saturated to near-black and read as a solid ideogram rather than as marks.
Filling one path takes the color once. The export column is the same change seen
from the other side: one `<path>` where a figure used to carry a `<rect>` per
alignment.

**The repaint column is layout and path building, not rasterization** — the
bench's context is a mark, so nothing there measures what the GPU or Canvas2D
does with the path. What it does bound is the per-frame JS, and at 250k marks
that alone is a frame. Reaching that takes a query row on the whole genome with
the target row narrowed to one contig, and the toggle is off by default, so
nothing pays it without asking.

## Cheaper thing this is not

Panning the facing view so the mate comes on screen is not the same feature and
does not compete with it: the mate contig has to already be a displayed region
for that, and the case here is precisely that it is not.
