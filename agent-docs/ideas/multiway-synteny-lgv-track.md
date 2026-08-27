---
name: multiway-synteny-lgv-track
description: Follow-ups to the multi-way synteny LGV track — per-base alignment lanes, the selection-scan pairing demo, multi-copy and self-comparison lanes, HPRC-scale lane selection and placement providers, and what the interaction surface still lacks now that lane order has a menu. Read before extending MultiWaySyntenyDisplay or proposing a demo on it.
---

# Multi-way synteny LGV track follow-ups

What shipped 2026-08-22 (`MultiWaySyntenyDisplay`, plugins/linear-comparative-view):
one lane per genome inside a plain LGV, the anchor lane on the view's axis and
every other lane in its own local coordinate frame — the non-anchored move that
clears the "projecting the graph onto the reference axis" rejection in
[REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md), because nothing is
projected: the ribbons carry the correspondence. Sources are anything whose
features carry a `mate` per other assembly (MCScan blocks tables, all-vs-all
PAF); lanes draw gene models from each assembly's own GFF3 track; an
alignment-level source additionally fetches each adjacent lane pair's direct
records. The user guide is `user_guides/multiway_synteny_track.md`. What follows is what
was deliberately NOT built, with the reasoning that shaped each cut.

**Per-base alignment lanes (CIGAR in row-local frames).** The most-wanted
extension and the wrong one to bolt onto this display. The backend draws
tens-to-hundreds of glyphs packed on the main thread; per-base mismatch
rendering at LGVSyntenyDisplay
density is worker-emitted GPU geometry, and every existing emitter
(`buildSyntenyGeometry`, the alignments packers) emits into reference-anchored
or view-pair frames. Row-local lanes need the worker to emit into each mate's
own frame — a frame the MAIN thread computes from the fetched placements, so
either the frame computation moves worker-side or the frame rides into the RPC
as part of the request key (and then every frame re-fit is a refetch; see the
follow-snap-grid refetch entry in [synteny-comparative](synteny-comparative.md)
for how that cost behaves). Treat it as a fourth backend consumer of the
synteny GPU stack, not as a change to this display.

**The demo corpus, and what a new one costs now.** As of 2026-08-24 the display
has a case per kingdom, and every one of them is a table some other pipeline was
already producing: plants (grape's seven-genome MCScan blocks, the five grasses,
the five nightshades), animals (five vertebrates over deep time, five flies over
shallow), humans (an HPRC CFH panel joined by CAT gene name), bacteria (the
E. coli all-vs-all PAF). The two added that day went in as species tables in
`build_orthofinder_synteny.sh` — a `case` branch naming Ensembl proteomes plus,
for a genome whose GFF3 names sequences by INSDC accession, one line of
`ALIASES` — so a sixth set is a table, an OrthoFinder run and a
`deploy-demo.sh` loop rather than new code. A `mammals` set (human, mouse, dog,
cow, pig) was scoped and not built: it sits between the vertebrates set's deep
time and the flies' shallow time and would say nothing either of them does not,
which is the bar a new set has to clear now that the display has one of each.

What each new set has to bring is a reading the others cannot: the flies bring
gene ORDER against chromosome identity (the correspondence print is 98% down to
77% while a window's rank agreement goes to zero, and the pseudoobscura lane
names the X because Muller D fused to it), and the nightshades bring SCALE
(comparable gene counts over 0.38-2.9 Gb, so one window's lanes come back at
1.5x and 3x rungs). Both are properties the lane headers state and the stacked
view cannot.

**The selection-scan pairing demo.** The storytelling shape the E. coli figure
proves — a quantitative signal above, the lanes naming which genomes explain it
below — has no hosted GWAS/Fst/selection wiggle sitting on the same anchor as a
multi-genome track. The demo worth building is the one that recreates the
figure this whole track was pitched from (Jiao & Schneeberger 2020, Fig 3d):
Arabidopsis accessions with a diversity or selection statistic over Col-0 plus
per-accession assemblies and annotations. Candidates in order of data
readiness: Arabidopsis 1001/MPIPZ accession assemblies (annotations exist,
statistic must be computed), Dog10K (the parked 4-5 hour wolf-ancestry sweep in
[figure-work-parked](figure-work-parked.md) would BE the top panel, but there
is one dog reference, not per-sample assemblies — the lanes would need the SV
callset as a placement source instead), DEST Drosophila (statistics hosted,
no per-population assemblies). None is an afternoon; all need `deploy-demo.sh`
hosting, so they belong with the tutorial-data pipeline work.

**Multi-copy lanes.** `computeRowFrame` keeps one refName (the dominant one)
per lane, so a genome holding two homoeologous copies of the anchor window
shows only the better-populated one. The worked example is maize's WGD in the
grasses demo (`orthofinder_synteny/grasses_maize_wgd` draws it as two stacked
rows in the synteny view: maize `1:286.7M` AND `5:6.3M` for one rice window).
The lane model that fixes it is lane-per-REGION rather than lane-per-assembly —
cluster a lane's placements (the median-reach filter already computes the
cluster it keeps; the change is keeping the runners-up as additional lanes with
the same assembly label). That also unlocks the wheat homoeolog case, which is
today doubly excluded: `wheat_homoeologs` names one assembly twice, and the
display drops mates whose assembly equals the anchor's (a rule that exists
because paralogy records in an all-vs-all PAF name the anchor as their own
mate). A self-comparison mode has to distinguish "this track compares wheat to
itself on purpose" from "this record is a repeat hit", and the blocks adapter's
copy-column machinery (`columnsFor` in MCScanBlocksAdapter) already carries the
purposeful case — the display would read WHICH column a placement came from,
which the `mate` object does not currently say.

**HPRC at scale: lane selection.** Two haplotypes are a figure; 464 are not a
lane stack. The removed `884a126861` display had the right concepts to
resurrect — `GenomeSubsetSelector` and the cluster-identity-matrix RPC that
ordered genomes by similarity over the visible window — and the shipped
`TreeSidebarMixin` (used by MAF/variants/wiggle) is probably the modern home:
lanes as `sources`, cluster-by-identity as the `run` callback. Prerequisite is
nothing in the display; it is a placement source that answers "which haplotypes
differ here" cheaply, which is the wave VCF's genotype matrix, not the
alignment.

The ORDER of whatever set that picks is its own file —
[ordering-synteny-lanes-by-similarity](ordering-synteny-lanes-by-similarity.md),
which reaches the same "not from the alignment at cohort scale" conclusion by
counting fetches, and adds the two constraints this paragraph does not: a ribbon
joins only ADJACENT lanes, so the objective is seriation rather than clustering,
and the shared-group matrix the gene sources need is free where the alignment
one costs N(N-1)/2 adapter calls.

**Placement and annotation providers beyond the two shipped.** The display's
contract is source-agnostic in two places: placements (features-with-mates from
the track adapter) and lane annotations (first single-assembly GFF3 track per
lane, found in the session). Two providers were designed but not built, both
recorded in the session that built this track: impg-precomputed placement
tables for HPRC (the all-vs-1 PAFs in [HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md)
are anchor-shaped already; a live transitive DFS over PIF was rejected as
round-trip-bound in [synteny-comparative](synteny-comparative.md)), and
GAF-annot (jmonlong's vg annotate route) as an annotation provider — one
artifact for all haplotypes, resolvable locus→node-ids→GAF through the
`segs.bed.gz` index as a two-stage tabix, with the caveat that per-haplotype
walk offsets are exactly what the 19x-smaller reference-keyed index dropped
([PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md)).

**The interaction surface.** What shipped since: hovering a ribbon highlights
its whole ortholog group across every lane (`hoveredGroupKey`, main-thread
recolor), and the track menu carries **Launch stacked synteny view (visible
region)** — the `syntenyRegionMenuItems` dialog seeded from this track alone,
which is the "lane you want to drive independently" handoff. Lane order is
densest-first by default (`rowAssembliesOf` counts placements over the fetched
block set, not the viewport, so it holds still across a pan), which is what the
tutorial used to tell a reader to hand-author `rowOrder` for.

`rowOrder` has a UI as of 2026-08-26: **Lanes** on the track menu, a row per
lane with Move up/Move down/Hide lane, a Show row per hidden lane and a reset,
beside toggles for `drawCurves`, `bridgeSkippedLanes` and `showLaneTicks`
(`menus.ts`). A move writes back the WHOLE order it is looking at rather than
the lane that moved — `rowOrder` pins what it names and leaves the rest
densest-first, so pinning one lane would leave the others free to re-sort under
it between two moves. Since 2026-08-27 a mate lane's label drags too
(`laneDrag.ts`, the headers in `MultiWayOverlay.tsx`): the band under the
pointer is the drop row, the drop writes the whole order back the way the menu
does, and a drop on the anchor's band lands the lane first below it. Hidden
lanes are `hiddenLanes`, a declared property beside `rowOrder`, and
`rowAssemblies` filters them out so every layer and fetch forgets the lane at
once. The label also carries a menu (right-click, or the ⋮ at its end;
`laneHeaderMenuItems` in `menus.ts`): the track menu's own Move up/Move
down/Hide lane row, **Open ⟨assembly⟩ in a new view** — `LaunchView-LinearGenomeView`
on the lane's frame with this track along — and **Re-anchor on ⟨assembly⟩**,
which is `navToLocString` on the HOSTING view with the lane's assembly, since
the anchor lane reads off `lgv.assemblyNames[0]` and the old anchor drops into
a mate lane on its own. Both hops are dead while the lane places nothing or the
session does not hold the genome; the anchor lane's menu is the open-in-new-view
copy of the view region alone.

**A ribbon bridges a lane that places nothing for its group**
(`bridgeSkippedLanes`, on by default, 2026-08-27). A ribbon joined ADJACENT
lanes only, so a group the middle lane's table did not name broke the chain
there, and the reader saw two disconnected halves for what the data says is one
group. `buildRibbonGeometry` now walks down from the upper lane to the next
lane that places the group and draws that pair in its own layer
(`ribbons:<row>><toRow>`, spanning the skipped bands). It is a separate cell
and layer rather than a longer ribbon in the pair's cell because the pick
engine reads a ribbon's y extent off its layer. Half opacity was tried first
and dropped: over the 0.3 base it was invisible against the band, and a ribbon
crossing a band with no glyph at either edge already reads as passing through. Hiding the sparse lane
is the other answer to the same picture, and the two compose. The stacked
`LinearSyntenyView` has the same gap and no such fix: a level is defined as the
gap between `views[level]` and `views[level + 1]` in ten files, so a track that
joins row 0 to row 2 across row 1 is a level with a span, not a setting.

**Lane scale legibility, and what is still open on it.** Every lane sits in its
own frame, and until 2026-08-24 nothing in the picture said so: the view's
gridlines (`Gridlines.tsx`, painted under track content at the ANCHOR's bp
ticks, full track height, inside `ZoomTransform`) ran through every lane and
were the most confident regularity on the page. What shipped: an opaque band
per mate lane, tiling the whole area below the anchor so those gridlines stop
where they are true; each lane's own ticks at one shared interval
(`tickIntervalFor`/`frameTickXs`), so tick spacing reads as bp/px across frames;
a header stating span and the anchor multiple where it is not 1, on the anchor
lane too; frames snapped to a `SCALE_LADDER` rung with the center on an eighth
of the span, so the scale is a round number and a small pan stops re-fitting
every lane; and straight chords by default (`drawCurves`, matching
`LinearSyntenyView`), whose slant is the offset between two frames.

A second pass on 2026-08-24 took on the ribbon zigzag. Three things caused it.
`groupSpanOnRow` filtered placements on refName only, so the repeat hit
`computeRowFrame`'s median filter had just thrown out of the FRAME came back as
a drawn span — `rowFrameX` extrapolates, the rect was clipped by the svg and
looked fine, and the ribbon kept the endpoint and swept the page. A lane's
horizontal position was an accident of where its leftmost placement fell.
And orientation was decided against the anchor rather than against the lane
the ribbons are actually drawn to.

`decideLaneFrames` walks the lanes top down and fixes the second and third.
Splitting a lane's bp→px map into a scale and an offset lets the two be chosen
for different reasons: the scale off the ladder for honesty, the offset for
legibility. Minimizing `sum |x_upper(g) - x_lane(g)|` at fixed scale is L1, and
since a ribbon only joins ADJACENT lanes the objective is a chain — it
decomposes into one choice per lane and each choice is the weighted median of
the displacement to the lane above, clamped to the slack the rung left over the
fitted extent — and held, once made, while the frame still shows what it placed
(the incumbent rule below). What it cannot fix is two lanes on different rungs:
their spacing genuinely differs by the rung ratio, so the medians align and the
ends fan, and that fan IS the scale difference.

Still open on the zigzag: collapsing collinear runs into block ribbons
(DAGchainer's chaining, per lane pair — walk the shared groups in the upper
lane's order and extend a run while the lower lane's rank advances by one in the
same direction). Most of the remaining ribbons are individually thin and
collectively collinear, and one band per run would cut both the clutter and the
svg node count. It is parked because it changes what a ribbon IS: hover reads
one ortholog group today, and a run either becomes the hover unit or has to
carry its members. Lane ordering could also use it — seed with the densest lane,
then append whichever unused lane shares the most collinear runs with the last
one placed, which shortens the travel without giving up the density-first
property that keeps chains running.

Still open: a **Match anchor scale** mode (one line in `computeRowFrame` — every
lane's span is the anchor's, and content that does not fit runs off the lane
edge, which is itself the information) and the height story. The display's
`height` slot defaults to 240 rather than the base schema's 100, which stops the
seven-genome demos landing on the 5px glyph floor, but a lane count past about
eight still crushes: `TrackHeightMixin` is composed and `scrollableHeight` is
never supplied, so the lanes divide whatever height there is instead of
scrolling. The fix is a fixed lane pitch plus `scrollableHeight`, which drags in
`VerticalScrollbar` + `useVirtualScrollWheel` the way `FeatureComponent` mounts
them — or `HeightModeMixin`'s grow mode, whose `growTargetHeight` hook is
exactly `rowCount * pitch`, with the caveat that
`heightModeConfigSchemaFields` pins `promotedBase: 'fixed'` so grow is a menu
choice rather than this display type's default. Ribbon color modes shipped
2026-08-27 as `ribbonColorBy` (`default`/`strand`/`identity`, **Color ribbons
by** on the track menu): a main-thread recolor off the synteny view's own
scheme and ramp, no refetch. Strand reads the DRAWN twist rather than a
record's strand — the spans are ordered pairs, so a crossed ribbon is an
inversion relative to the lane above and two lanes both reversed against the
anchor come out straight between themselves, which a per-record strand would
get wrong. Identity reads the group feature's `identity` (a pair without one keeps the slot color — the synteny view's missing-value red would read as a value here), which on an
N-genome MCScan table is the row's (`attributeColumns`) and so one value per
group; an all-vs-all PAF's is per pair only on the direct-record ribbons, since
a group keeps its first pairwise feature. Per-lane pan/zoom stays deliberately absent: the lanes re-fit to the
anchor's viewport by design, and the launch above is the route to a lane you
drive yourself.

**Gene glyph rendering.** The lanes draw the canvas gene track's geometry —
merged CDS full height, exon-minus-CDS thinner in `utrDefaultColor`, intron
chevrons, a downstream arrowhead, direction resolved in pixel space so flipped
lanes point the way they read — through that track's own rect, line, chevron
and arrow passes and its Canvas2D painters, exported from `@jbrowse/plugin-canvas`
for exactly this. `geneGlyphGeometry` is the interval math; `multiwayGeometry.ts`
packs each lane into one cell in the stack's px, offset into the passes'
unsigned coordinate by `PX_ORIGIN`, so a lane's `bpRangeX` uniform is a px
range and the drag is the only per-frame input.

**A lane draws annotation where it has it and the table's box where it does
not, per GROUP.** The choice was per LANE until 2026-08-26, so one drawn gene
suppressed every placement box on that lane — and a table naming genes the
lane's GFF3 does not is the ordinary case rather than a corner, since the two
are different releases. The demo shows it: `grape.blocks` pairs four genes and
`grape_genes.gff3` names two, and the other two hung their ribbons off nothing.
`isAnnotated` tests in PX rather than bp, which is what lets one rule cover both
kinds of lane — the anchor lane's genes and its group spans both come through
the view's axis, a mate lane's both come through its frame, and neither pair is
comparable in bp with the other.

**Launch-side outlier robustness — shipped.** Found filming the grasses launch
tour: `resolvePanel`'s span union kept every block on the winning contig, so
one stray same-contig orthogroup hit stretched a launched panel to tens of
megabases (brachypodium came back `1:5,237,628..54,451,482` for a 185 kb rice
window whose lane frame was 185 kb). `computeRowFrame`'s length-weighted-median
filter is now `keepNearMedian`, shared with `resolvePanel`, which applies it
on the winning contig with the region of interest as the unit. The grasses
launch tour (`multiway_launch_stack`) films a row being unticked for exactly
that span and wants re-filming. The display groups on gene name with `syntenyId` as
the nameless fallback; the first-class `syntenyGroupId` this approximates is
specified in [synteny-comparative](synteny-comparative.md) §"syntenyGroupId for
cross-row block identity" and should be built there, not here — this display
becomes its third consumer, after colorBy:group and cross-row hover in the
synteny view.

**What the phase covers, and the scrim race behind it.** `displayPhase` holds
at `loading` for the two dependent fetches until they FIRST land, and not for
any refetch after that. Holding it for every refetch put the striped scrim over
lanes that were already drawn on any pan that moved a quantized lane window: the
dependent fetch is debounced 500 ms and the overlay's anti-flash delay is
250 ms, so the scrim always won that race. Before the first commit there is
nothing on screen to flash over and a capture would shoot placement boxes, which
is what the gate is for; after it, the lanes are an enhancement over boxes that
are already correct, and a refetch says so through the corner progress chip that
`ready` gates. So `displaySettled` — `[data-display-phase="ready"]`, what every
figure spec waits on — covers a load-and-shoot and not a pan-then-shoot. Every
`multiway_synteny/*` spec is the former; a pan-then-shoot one would need a finer
wait and should add it then.

**What this shares with SyntenyFollow, and what it does not.** Both answer
"given the pairwise alignments under a window of genome A, where in genome B
does that window correspond, and which way round" — `SyntenyFollow` as a
navigation of a real LGV panel (bp regions, `moveTo`, CIGAR-exact through
`cigarMapSpan`), this display as a lane-local affine frame at a fixed viewport.
The shapes do not unify: a `RowFrame` is one linear ramp over one refName, a
followed row is a `displayedRegions` layout, and multiway has no navigation to
perform. No function is duplicated between them today. The genuine near-twin in
this neighborhood pairs SyntenyFollow with the LAUNCH instead —
`interpolateFollowSpan` and the CIGAR-less branch of `resolvePanel`'s
`resolveSpans` are the same clamp-to-block interpolation with the same
reverse-strand walk from `mate.end`.

Two things did cross, and the first was a bug. `followAnchorWindows` weighs a
contig by SCREEN PX and `resolvePanel` by ANCHOR bp, while `computeRowFrame`
counted placements — so a cluster of short repeat hits could put a lane on a
different contig from the panel launched off the same data. It weighs anchor bp
now, the same axis as `resolvePanel`, and a test over a fixture where the anchor
and mate axes disagree pins the two to one answer. The second is a discipline:
`followWindowMapping`'s resolve refuses to extrapolate past its outermost block,
because "a scale measured elsewhere would invent a correspondence" — which is
what `rowFrameX` does freely, and why `frameSpan` now clips rather than tests.

The anchor lane took a third pass on 2026-08-26 for the same reason and the
opposite failure. `bpToPx` neither clips nor extrapolates: it answers `undefined`
for a coord outside every displayed region, so an interval straddling one lost
BOTH ends and was dropped whole — the group vanished from `anchorSpans` and so
from `anchorAbsX`, the seed every lane below lines up on, while the mate lanes
went on drawing its placement. That is only visible where `displayedRegions` is
a slice of a contig rather than the whole thing, which is the shape a launched
panel, a bookmarked region and a synteny row all have. `axisSpan` is the
ordered-pair counterpart to `frameSpan`, built on core's
`clipToDisplayedRegions` — the same primitive `getLayoutHighlightCoords` was
written off, exported because its own min/width return loses the order a ribbon
endpoint needs.

What would transfer next is rung 3: `followSpreadSpans` and `spanBounds` place a
row on the UNION of what several contigs map to, which is the machinery the
parked multi-copy lanes (lane-per-region) need. `spanBounds` itself is offset
space over `displayedRegions` and a `RowFrame` lane cannot consume it, so what
actually moves is the union-of-spans idea plus `spreadDecision`'s coverage and
`partialShare` gating — the hard-won part, and the reason to build lane-per-
region on the follow side's concepts rather than a second time here.

**Every per-settle choice holds until the evidence clearly moves.** A lane's
frame was a pure computed until 2026-08-26, re-run on every coarse-block update
and every scroll pixel: contig, orientation and rung decided from scratch, the
offset re-fitted and clamped to the rung's slack. So a lane froze under a drag
while the anchor slid out from under it, lurched by hundreds of px each time
the settled blocks refreshed, and re-voted everything at settle. `laneDecision.ts`
makes the decision once per settled block set (`installLaneFrameDecision`)
carrying the previous one, and every choice has an incumbent: the contig by
`preferIncumbent`'s switch margin; the cluster the fit is centred on by the same
rule (`keepNearMedian` takes the incumbent centre — cacao's fit swung between
1.2 Mb and 4.7 Mb on consecutive steps as the median hopped between two
paleo-blocks); the rung by a shrink room; the orientation by the follow's 0.9
deadband over at least five shared groups, carried across a contig change since
the anchor-order sum a fresh lane falls back on is the noisiest vote there is;
and the placement by coverage, held while the frame still shows 90% of the
placed weight.

What a decision states is `{refName, flipped, rung, pivotAnchor, pivotLaneBp}`
— the lane bp pinned under one anchor coordinate, at a rung of the anchor's
span. The frame is derived from that against the live view
(`frameFromDecision`), so a pan translates every lane 1:1 with the anchor and a
zoom scales it about the pivot: the data × view-transform contract the GPU
displays draw under. The stack is laid out against the scroll offset of the
last settle (`renderOriginPx`) and translated by `dragOffsetPx`, which is the
one live number in `renderState`: a pan uploads nothing and redraws one frame.

Measured on the deployed `demos/grape_peach_cacao` — a 2Mb window walked across
grape chr1 in 100kb steps, 259 steps, every lane read out of `decideLaneFrames`
itself with the previous step's decision carried in. A CHANGE IS NOT A FLICKER,
so a lane moving from one syntenic block to the next and staying is counted
apart from one that leaves an answer and comes back within a fifth of a window.

<!-- BEGIN GENERATED MEASUREMENT multiway-lane-stability -->

| lane        | contigs seen | contig chg | contig osc | drawn flip chg | drawn flip osc | fallback flip chg | fallback flip osc | empty steps | rung chg | rung osc | slip steps | median slip px | max slip px |
| ----------- | -----------: | ---------: | ---------: | -------------: | -------------: | ----------------: | ----------------: | ----------: | -------: | -------: | ---------: | -------------: | ----------: |
| peach       |            2 |          3 |          0 |              3 |              0 |                10 |                 2 |          33 |        7 |        0 |         29 |            261 |       4,705 |
| citrus      |            3 |          7 |          0 |              4 |              0 |                11 |                 1 |          33 |        3 |        0 |         26 |            351 |         901 |
| cacao       |            1 |          2 |          0 |              5 |              0 |                17 |                 2 |          33 |       11 |        0 |         95 |             85 |      24,382 |
| poplar      |            5 |          8 |          0 |              7 |              0 |                16 |                 4 |          33 |        4 |        0 |         54 |            128 |       3,596 |
| tomato      |            4 |          8 |          0 |              8 |              0 |                18 |                 7 |          33 |        7 |        0 |         56 |             71 |       4,280 |
| arabidopsis |            4 |          8 |          0 |              6 |              0 |                15 |                 5 |          34 |        2 |        0 |         60 |             72 |         710 |

<!-- END GENERATED MEASUREMENT multiway-lane-stability -->

Every `osc` column is zero. The drawn flip changes that remain (3 to 8 per
lane) are lanes moving between syntenic blocks and staying; the `fallback`
columns are what the anchor-order sum alone would do, kept as the control. The
stateless version of the same walk had 1 to 7 flip oscillations per lane and 10
to 21 flip changes, and arabidopsis changed contig 12 times with 3 of them
oscillations. `empty` is windows where the lane places nothing at all, the same
33 for every lane, and no rule can fill them. `slip` is how far a lane's content
moved on screen beyond the anchor's own pan, counted only on one contig,
orientation and rung: a held lane slips 0, and each re-alignment is one slip.
The medians are the ordinary re-alignment (71 to 351 px); the maxima are the
kept cluster hopping to another paleo-block on the same contig, which is a
relocation the way a contig change is.

**What it took, beyond the deadband.** The contig vote was steady before any
incumbent — weighting a contig by how much of the ANCHOR it explains is
decisive on paleopolyploid data — and the orientation was not: both of its
votes moved in the same places, so overriding one with the other bought
nothing. The deadband alone did not close it either. The last oscillations came
from a contig change resetting the orientation to the anchor-order fallback,
which the vote then corrected a step later, and from three reversed genes
mirroring a whole lane. The rung had an oscillation of its own, since the
cluster `keepNearMedian` keeps is a discrete choice too.

Measured on a real drag in the browser (`website/scripts/multiway-drag.probe.ts`,
the tutorial's own session at 1588 px, headless): before, each mate lane moved
on 6 of 50 drag frames, in steps of −8 px to −3060 px, every lane slid 50 to
260 px at settle, and a monotonic 12-step zoom-out re-snapped tomato's rung
1.5 → 1.0 → 2.0 → 3.0 with two lane-gene refetches. After: every lane moves on
every frame with a median slip of 0.0 px against the anchor, three of six
lanes never leave it, five of six hold still at settle, the zoom-out moves
tomato's rung monotonically (1.5 → 2 → 3 → 5) and refetches nothing, and the
React flush per scroll frame is 2.0 ms where the per-frame relayout it
replaces cost 15.0 ms.

**The backend landed 2026-08-27** — ribbons and ticks on the pairwise synteny
passes, lanes and bands on the feature track's glyph passes, Canvas2D and the
SVG export off the same cells (`multiwayRenderTypes.ts`, `multiwayGeometry.ts`,
`GpuMultiWayRenderer.ts`, `Canvas2DMultiWayRenderer.ts`). The same probe on
the same session, 1588 px, headless: the display's DOM is 22 nodes (the
headers) where it was 774; React per scroll frame 1.1 ms (was 2.0, and 4.8
before the model change); a zoom step is 2.0 ms of React where it re-rendered
every SVG element at 35 ms, with 12.7 ms of MobX per step packing the cells —
the next lever, if one is wanted, is that rebuild rather than the frame.

**A broken hold re-aligns, and sliding the least distance instead was tried
and measured out (2026-08-26).** When a hold breaks — the lane's content has
moved to another block, or 10% of it has left the frame — the lane jumps to its
re-alignment in one step (peach +388 px, tomato −2859 px across one drag), and
the obvious fix is to slide only as far as restores coverage. Built and walked
across grape chr1 with the stability probe, the least slide leaves a placement's
centre exactly on the frame edge; the next pan pushes it out by the pan step and
the least slide brings it back by exactly that step, so the lane pins to that
placement and stops panning with the anchor — the slip histogram's median was
the pan step itself, on 145 of 226 steps against 29 for re-alignment, and the
two rules travelled the same total distance (peach 14,714 px against 14,829).
The travel is fixed by the data; the rule only chooses between rare
re-alignments and pinned creeping, and re-alignment stays. What did land from
that pass is the pivot carrying across a rung change: a zoom is a scale about
the pivot and not a relocation, so a rung change re-aligns only when the
rescaled frame no longer shows the content.
