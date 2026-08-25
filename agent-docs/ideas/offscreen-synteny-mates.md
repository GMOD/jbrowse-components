---
name: offscreen-synteny-mates
description: Showing alignments whose mate lands on a contig the facing view is not displaying, as a mark/box rather than a ribbon. Class A SHIPPED 2026-08-19 — counted, drawn behind a toggle, labelled, named on hover, clickable to show the mate LOCUS (with an Undo, since the navigation replaces the row's regions), and carried into an SVG export. Class B shipped the same day behind `bidirectionalFetch` (two-axis-synteny-fetch.md), on the terms this file settled: its marks hang off the target axis and its click navigates the row above.
---

# Off-screen synteny mates, drawn as something other than a ribbon

**Class A shipped on 2026-08-19, all three stages.**
`collectOffscreenMates` tallies the drops per contig and places them on the
query axis; the settings menu's fixed-label "Off-screen mates" radios turn
`OffscreenMateOverlay` on, which draws each as a mark at the top of the band,
labelled with the contig it points at; hovering one names that contig whether or
not the run is wide enough to be labelled and reports how many alignments on
this band go there, and clicking one shows the locus its alignments land on, on
the facing row, undoably. An SVG export carries the same marks. The
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

*2026-08-20:* the BAND is the drawing unit, not the strip. Class B put a second
strip on the far edge, and the two were drawn one call each — so their marks
could not collide (opposite edges) but their labels, which stack INWARD from
those edges, were placed blind to each other and met in the middle. On a 50px
band both lanes offered the same three baselines and a query name landed on
exactly the pixels of a target name; on the 80px band a four-level stack
auto-scales to, the two third rows landed 6px apart. One call now takes every
lane, and one rule covers both cases — a name may not share a baseline, or come
within a row of one, with an overlapping name already placed. Between stretches
at the same x it takes one from each lane before a second from either, or the
lane drawn first took every row a short band has.

*2026-08-20:* the marks are the BACKGROUND and the label is the finding, so they
are not the same grey. At full `text.secondary` the strip read as the loudest
thing in a band of 0.2-alpha ribbons, which inverts what a reader should look at
first; the marks are now that color at 0.35 alpha and the labels are not. The
published figures in the user guide predate this.

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

  IT WAS TOO COARSE, revisited 2026-08-20: a bare refName is a whole chromosome,
  so a click meant to answer "what is over there" answered it by zooming out past
  everything else. Not through the resolve RPC, though — the collector already
  had the mate coordinates in hand and was dropping them, so `mateStarts`/
  `mateEnds` ride along per placed alignment and the click costs no round trip.
  It also answers for the MARK rather than for a feature, which the resolve could
  not: `MIN_OFFSCREEN_MATE_WIDTH_PX` piles a run of anchors into one column
  wherever a contig has more of them than the strip has pixels, so the click
  unions the mate spans under the pointer (`offscreenMateSpanAt`). Picking one of
  them instead is arbitrary in a way a reader sees — the same visible mark,
  clicked at two window widths, goes to two different places. Floored to
  `OFFSCREEN_MATE_NAV_MIN_BP` so a lone small anchor does not land the row at
  sequence zoom with nothing around it, which is the same failure from the other
  end.

  The click is `navToLocString`, which REPLACES the facing row's displayed
  regions — the exact narrowing the follow must never do to itself. Here it is
  the request, not a side effect. "The row's own header undoes it" was the answer
  for a year and it is not one: "Show all regions" is a different destination,
  not an undo, and what the click discarded may be a region list built over
  several navigations. The navigation now raises a snackbar carrying an **Undo**
  that restores the row's regions, zoom and scroll — an actionable info toast,
  which `SnackbarModel` deliberately does not auto-hide.

  WITH THE FOLLOW ON, THE CLICK TAKES THE ANCHOR. A row the follow MOVES is
  re-asserted onto the anchor's mapping every time the anchor settles, so
  clicking a mark on such a row ran, posted its snackbar, and left the row
  exactly where the follow wanted it. Anchoring the row is what the click means —
  this row should show that contig, and the others should come to it — and the
  undo restores the anchor with the regions.
  `LinearSyntenyOffscreenMateFollow.test.tsx` holds it.
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
  band. Its count comes off the same tally the overlay draws from, scoped to
  this band rather than the view, and the tooltip is now the only place that
  count is shown: the hamburger item that used to carry it in its label is gone,
  and the control is a fixed-label radio submenu, so nothing states a live
  number twice.
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

|   marks | hover over ribbons | hover, before | hover in the strip | click in the strip | one repaint | SVG export layer |
| ------: | -----------------: | ------------: | -----------------: | -----------------: | ----------: | ---------------: |
|   2,767 |           <0.001ms |       0.039ms |            0.038ms |            0.046ms |     0.351ms |            90 KB |
|  50,000 |           <0.001ms |        1.33ms |             0.64ms |             0.75ms |      5.86ms |         1.303 MB |
| 250,000 |           <0.001ms |        8.27ms |             3.37ms |             4.11ms |  **35.1ms** |         6.624 MB |

<!-- END GENERATED MEASUREMENT offscreen-mate-overlay -->

On the shape this was designed against the overlay is free: a repaint is a
quarter of a millisecond, against the 12.5ms the pick engine's own warm hover
costs on an all-vs-all PAF (`reference/SYNTENY_PICKING.md`). The 2026-08-20
re-measurement ran on a loaded machine — `hover, before` is untouched code and
moved with everything else, so read the columns against each other rather than
against the numbers this table held before.

**The hover is independent of the mark count, and deliberately.** The strip is a
few pixels of a band ~100 tall, so nearly every pointer position `offscreenMateHit`
is asked about is not in it — and it runs ahead of the ribbon pick on every
mousemove. Testing the strip height before any alignment is what collapses that
column; laying the level out first to answer "no" is what the `hover, before`
column is, and at 250k marks it is 8.3ms of every frame the pointer moved.

**The click is the one path that cannot early-exit,** and it is a separate
function for exactly that reason (`offscreenMateSpanAt` beside
`offscreenMateAt`). Where a mark stands for a run of anchors — anywhere a contig
has more of them than the strip has pixels — the locus it navigates to is the
union of their mate spans, which is every alignment under the pointer rather than
the first one found. That is a full pass of the lane: 0.046ms on the demo
fixture, 4.1ms at 250k marks. Once per navigation, so it is paid where a user has
just clicked and is waiting; put on the hover it would be paid per pointer move,
which is why `OffscreenMateTooltip` says "that locus" and leaves the coordinates
to the snackbar the click raises.

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
the target row narrowed to one contig.

*2026-08-20:* the toggle **went on by default** after this table was measured,
so that state now pays the repaint column without asking for it — which is the
one thing the default costs that a few pixels of band does not. The hover column
is not in that: it is what the pointer pays on every move, and testing the strip
height before any alignment is what makes it independent of the mark count. What
a reader in that state is looking at is a strip whose marks outnumber its pixels,
so if the column is ever worth attacking, the answer is a per-pixel-column
occupancy pass rather than a rect per alignment — and the label placement, which
runs off those same rects, is what makes that more than a draw-loop change.

## Cheaper thing this is not

Panning the facing view so the mate comes on screen is not the same feature and
does not compete with it: the mate contig has to already be a displayed region
for that, and the case here is precisely that it is not.

*2026-08-23:* **that paragraph was the blind spot, and class C is what it read
past.** "The mate contig has to already be a displayed region" is not the rare
case — it is what a stack of whole assemblies IS, and the multiway demo we ship
is one. Reported from `demos/grape_peach_cacao` with all three rows on whole
assemblies and "Mark them" on: the strip drew nothing, because
`v2RefNames.has(mate.refName)` is true for every mate when the facing row
displays every contig. Meanwhile `isRibbonCulled` was dropping all but the
ribbons reaching the visible slice — 125 of 126 instances in the volvox
reproduction. The one arrangement where "what am I not being shown" is hardest
to answer was the one arrangement the feature said nothing about.

| class | anchor | mate | why no ribbon | decided | marked on |
| --- | --- | --- | --- | --- | --- |
| **A** | visible v1 window | contig v2 does not display | no second endpoint | worker, per fetch | query axis |
| **B** | contig v1 does not display | visible v2 window | never requested | worker, per fetch (`bidirectionalFetch`) | target axis |
| **C** | visible v1 window | contig v2 displays and has scrolled off | `overdrawPx` cull | **main thread, per repaint** | query axis |
| **D** | contig v1 displays and has scrolled off | visible v2 window | `overdrawPx` cull | **main thread, per repaint** | target axis |

**C cannot move into the fetch, and that is the whole of its design.** The facing
row pans a full `syntenyPanBufferPx` without refetching, so a mark decided when
the data landed sits beside the ribbon it claims does not exist. It is therefore
a draw-time question asked against the same band `isRibbonCulled` uses —
`culledRibbonMates` restates that band in the facing axis's cumBp, and the one
comparison decides both, so a mark and its ribbon cannot both be drawn.

*2026-08-25:* **D is C read from the other row, and it shipped a strip short.**
`isRibbonCulled` drops a ribbon when EITHER end leaves its own row's band, so the
undrawable alignment whose query end is off screen and whose target end is in
plain sight is as real as C — and it was placed on the query axis alone, at an x
the layout rejects, so it drew nowhere: no ribbon, no mark, on either strip. What
made it visible from the menu is that the last step — "Mark them, both rows" as
it was then labelled — is the setting that goes and FETCHES that class: the
second query recovers alignments anchored on the lower row whose query end is a
pan buffer or more off the top row's edge, which is class D by construction. On peach chr1 18-22Mb over the whole of grape chr1
that is **849 of the 1029 alignments the level holds**, against 74 marks from
class B — so the second row read as having no marks at all while the first had
thousands.

`culledRibbonMateData` returns the pair now (`onQueryAxis`, `onTargetAxis`): the
instance walk resolves both axes already, so the transpose is the two extents and
one more per-contig tally, +6% on the per-fetch build and nothing per repaint.
The two cannot double-mark, because being outside a row's band means being more
than `overdrawPx` off that row's screen — so an alignment culled on one end has
exactly one axis the layout will place it on.

D does NOT need the second fetch, and is drawn at the middle step too: the fetch
window is the visible window plus a pan buffer, so the alignments in that margin
are held, culled, and have a target-axis position. On the grape/peach figure
zoomed to 4Mb that is not a sliver — the lower strip paints 8,004 device px at
the middle step against the upper strip's 3,984, and 18,024 with the second
query. So the setting gates the QUERY, which is the only thing that costs
anything, and the labels were rewritten to say so: the middle step names the
panels it marks ("Mark them on both panels") and the last names what it
queries ("Mark them, and query the lower panel for more").

**Off the instances, not the feature lanes.** `starts`/`ends` are the adapter's
untrimmed coordinates; a CIGAR-clipped block draws from corners the projection
loop moved, so a reprojected mark sits beside its own ribbon. Min/max over a
feature's instances also covers transparent-CIGAR mode, where the base trapezoid
is replaced by one tile per match segment and no single instance spans the block.

**What keeps it off the frame budget is the extent on `mateAxis`.** A facing row
whose band already spans every mate the fetch holds can hide none of them, so the
whole dataset leaves the lane on two comparisons — which is two rows zoomed out
over each other, the common state.

**Measured, and the surprise is what is NOT in it.** The per-entry band test
costs nothing: `repaint` and `control` — the identical dataset with the mate lane
removed, i.e. what a class A strip of that mark count costs — track each other at
every size. The repaint column is the rect-per-mark cost both classes already
had, and the table above is the same shape. What this change does to it is make
the ceiling REACHABLE in a state that previously drew nothing at all: query row
zoomed out, facing row zoomed in. The `covered` column is the other half — it is
what the extent buys, turning a 15ms walk at 100k features into nothing — and
`build` is the only genuinely new work, once per fetch.

<!-- BEGIN GENERATED MEASUREMENT culled-ribbon-mates -->

| features | instances | build, per fetch | one repaint | control (no mate lane) | repaint, band covers | hover over ribbons |
| -------: | --------: | ---------------: | ----------: | ---------------------: | -------------------: | -----------------: |
|   10,000 |    30,000 |           0.51ms |      1.03ms |                 0.93ms |                  0ms |                0ms |
|   50,000 |   150,000 |            2.9ms |      8.86ms |                 6.97ms |                  0ms |            0.001ms |
|  100,000 |   300,000 |           4.86ms |     15.04ms |                15.32ms |                  0ms |            0.001ms |
|  250,000 |   750,000 |          12.38ms |     42.07ms |                47.66ms |                  0ms |            0.001ms |
|  500,000 | 1,500,000 |          23.27ms | **166.1ms** |               168.39ms |                  0ms |            0.001ms |

<!-- END GENERATED MEASUREMENT culled-ribbon-mates -->

**The click stops being destructive in this class.** `navToLocString` REPLACES
the row's displayed regions, which is right for a contig that row does not have
and catastrophic for one it does — a click in the arrangement that produces these
marks would answer "your mate is over there" by discarding every other chromosome
of the row it was pointing at. A class C hit carries `displayed`, and its click
`centerAt`s instead.
