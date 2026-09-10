---
name: multiway-synteny-lgv-track
description: Follow-ups to the multi-way synteny LGV track — per-base alignment lanes, the selection-scan pairing demo, multi-copy and self-comparison lanes, HPRC-scale lane selection and the cohort hand-off, the graph data path, the four routes to more than one row per genome, the remaining LOD and byte work, and what the tests do not pin. Read before extending MultiWaySyntenyDisplay or proposing a demo on it; how the display works today is reference/MULTIWAY_SYNTENY_DISPLAY.md.
---

# Multi-way synteny LGV track follow-ups

What shipped 2026-08-22 (`MultiWaySyntenyDisplay`, plugins/linear-comparative-view):
one lane per genome inside a plain LGV, the anchor lane on the view's axis and
every other lane in its own local coordinate frame — the non-anchored move that
clears the "projecting the graph onto the reference axis" rejection, because nothing is
projected: the ribbons carry the correspondence. Sources are anything whose
features carry a `mate` per other assembly (MCScan blocks tables, all-vs-all
PAF); lanes draw gene models from each assembly's own GFF3 track; an
alignment-level source additionally fetches each adjacent lane pair's direct
records. The walkthrough is the second half of
`multiway_synteny_grape_peach_cacao.md`, and each demo set's own tutorial
carries its lanes.

How the display works once built — the lane stack and its frames, the adapter
contract, the cost of a lane at 8, 64, 464 and 4,000, the two named tutorials
and the correctness findings that have landed — is
[../reference/MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md),
whose landed block names what not to re-fix. What follows here is what was
deliberately NOT built, with the reasoning that shaped each cut, and what the
2026-09-06 reading of the display left open.

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

**What a placement is, since 2026-09-06.** The display still reads no CIGAR,
but the clip that cuts a record to the window (`clipFeatureToRegion`, under
`clipToRegion`) now also cuts it at every insertion or deletion of
`splitAtGapBp` or more (`splitSyntenyFeatureAtGaps` in synteny-core; the
display asks for 10 kb, the coarse tier's default bound, so the cut is the
same on either tier). Each gap-free run is its own feature, its `uniqueId`
and `syntenyId` numbered after the window suffix, so on a nameless source
each run is its own group with its own anchor and mate intervals — the shape
`anchorSpans`, `groupRunSpansOnRow`, the ribbons and `composeLaneLinks` all
read, so a ribbon subdivides at the gap and a composed link interpolates
within a run rather than across it. Runs were NOT made placements of one
group: a group carries one anchor interval and the gutter draws every anchor
span against every mate span of a group, so two runs in one group would draw
a cross product. At TP53 the mouse chain carries a 25 kb interior indel that
drew as one straight ribbon before this; the tutorial's caption said so as
conservation. The orientation vote changed with it: paired run-by-neighbour
and weighed by the lighter run, a chain cut into heavy forward runs with
small reversed repeat hits between them read backwards on the hits' say
(calJac4 at the 17p figure, 0.555 backwards over 36 kb of paired weight while
700 kb of chain ran forwards), so `orientationVote` now pairs every shared
run with every other and weighs a pair by the product of the two groups'
`weight` — a count of concordant gene pairs on a named table, anchor bp
squared on an alignment. The deadband and the hold are as they were. The
stability table below WAS re-measured after this, the same day, and the new
vote is worse on every lane of it; the paragraph under the table says by how
much, and the 17p table beside it says what the vote does and does not reach
on a pairwise source.

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
[figures-blocked-on-data](figures-blocked-on-data.md) would BE the top panel, but there
is one dog reference, not per-sample assemblies — the lanes would need the SV
callset as a placement source instead), DEST Drosophila (statistics hosted,
no per-population assemblies). None is an afternoon; all need `deploy-demo.sh`
hosting, so they belong with the tutorial-data pipeline work.

**Multi-copy lanes.** `computeRowFrame` keeps one refName (the dominant one)
per lane, so a genome holding two homoeologous copies of the anchor window
shows only the better-populated one. The worked example is maize's WGD in the
grasses demo (`orthofinder_synteny/grasses_maize_wgd` draws it as two stacked
rows in the synteny view: maize `1:286.7M` AND `5:6.3M` for one rice window).
Since 2026-09-01 the other copy is at least NAMED and reachable: `pickContig`
returns the contigs explaining a comparable share of the window (`alsoOn`, a
fifth of the drawn one's evidence), the lane header says "also on 5", and the header
menu offers "Show 5 in this lane", a per-lane pin (`pinnedLaneContigs`) that
outranks the vote until the reader lets the lane choose again — the synteny
follow's refused-spread report, applied to a lane. That is one copy at a time.
The lane model that shows both is lane-per-REGION rather than lane-per-assembly —
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
lane stack. The selection half landed 2026-09-06 as display state and a dialog
rather than as `TreeSidebarMixin`: `selectedLanes` (a session property, so a
shared session carries it; the config's `lanes` slot is what a hosted track
opens on) narrows `rowAssemblies` locally, without a refetch, since a graph
adapter has to identify every walk before it knows whose it is and a filter
sent with the fetch could save nothing. The universe the picker offers is the
header's `lanes` (an adapter declaring `adapterCapabilities: ['headerLanes']`
has its `CoreGetInfo` read even without a tier slot; `GbzBaseSyntenyAdapter`
names every haplotype, grouped by sample and labelled by PanSN prefix) plus any
lane the window places. What stays parked is the sidebar itself: the removed
`884a126861` display had `GenomeSubsetSelector` and the cluster-identity-matrix
RPC that ordered genomes by similarity over the visible window, and the shipped
`TreeSidebarMixin` (MAF/variants/wiggle) is where lanes-as-`sources` with
cluster-by-identity as the `run` callback would go, once a placement source
answers "which haplotypes differ here" cheaply — the wave VCF's genotype
matrix, not the alignment. The lane stack has its own geometry and headers, so
that is a larger fit than the picker was.

**Do not extend row-per-haplotype to the cohort.** Pixels, fetch and picking
each rule it out independently and each is sufficient; the three are costed in
[../reference/MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md)
§5.2. The scaling story is two surfaces with a hand-off between them, in three
steps:

1. **A carriage/genotype-first picker** over the cohort: the `pgbi.vcf.gz` snarl
   VCF (462 haplotypes of `GT`, 1.7 s for a 70 kb window remotely,
   [PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) "Release 2 files
   nothing here reads yet") or the wave VCF through
   `LinearMultiSampleVariantDisplay`, with `TreeSidebarMixin`'s
   cluster-by-identity ordering; rows at 1-2 px each, 464 or 4,000 of them; a
   click or a lasso yields a haplotype set.
2. **This display as the locus reading** for that set: the set becomes
   `selectedLanes` (session state already), and — once the reader takes a
   filter — the fetch.
3. **The graph view** taking the same set: `haplotypes` on `GetSubgraph`
   (`HAPLOTYPE_WALKS_VISION.md:70-73`), Sample rows drawing the chosen set.

Three smaller things go with that and are worth doing before anyone opens a
hundred lanes: make a graph source require a lane set — the `lanes` slot is
already how `demos/hprc_multiway` opens on eight, and "every lane the source
places" should not be the default when the header declares more than, say, 32,
which is a refusal with the picker open; cull scrolled-out layers in
`renderLayers`; and cache `laneGeneAdapters` by (track set, lane set), since it
is O(sessionTracks × lanes) `isSameAssemblyName` calls on every `rowAssemblies`
change and is the first main-thread cliff at cohort scale. The picker dialog
itself is fine to ~500 and should not be made to scale further.

The ORDER of whatever set that picks is its own file —
[ordering-synteny-lanes-by-similarity](ordering-synteny-lanes-by-similarity.md),
which reaches the same "not from the alignment at cohort scale" conclusion by
counting fetches, and adds the two constraints this paragraph does not: a ribbon
joins only ADJACENT lanes, so the objective is seriation rather than clustering,
and the shared-group matrix the gene sources need is free where the alignment
one costs N(N-1)/2 adapter calls. What the 2026-09-06 reading adds is which
demo is waiting on it: the 44-way E. coli page orders by density, so the K-12
derivatives lead at the O-antigen locus for sharing the most symbols and the
reduced Shigella genomes fall toward the bottom with nothing naming them. The
weighting half of that reading landed — `rowAssembliesOf` sums `group.weight`
rather than counting placements — and the half still open is step 1 of the
ordering document, the gene-group seriation, which is main-thread and needs no
RPC.

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

**The graph data path, and what Sample rows should draw.** A GBZ lane's records
come from `GbzBaseSyntenyAdapter` in `jbrowse-plugin-graphgenomeviewer` over the
`gbz-base-js` reader, and today the adapter extracts, identifies and aligns
every walk in the window and then filters — so lane selection saves the
display's per-lane work and nothing on the query. In order: release and adopt
the reader's `keepHaplotypes` and W-line direction fix (the plugin pins 2.3.0
and both sit after the tag, at `add1f2f`); pass a haplotype set into
`alignments()`, which is per path and could take a handle filter today for
about a quarter of a window's time (`HAPLOTYPE_WALKS_REVIEW.md:45-55`); cut
static GFAs with `--keep` for every tutorial locus now, which meets the same
need at zero runtime cost for a fixed locus and set
(`HAPLOTYPE_WALKS_VISION.md:94-100`) and does not generalise to a window the
reader chooses; then the companion's reference-anchored samples plus a per-path
walk (`HAPLOTYPE_WALKS_VISION.md:54-73`), which is the only route to "eight
lanes out of four thousand read eight haplotypes' worth of data". Add
`identity` to the reader's records so the identity colour mode stops being dead
on a GBZ lane (`GBZ_HANDOFF.md:288-293`). And measure the reader's `align()`
against `gfa_to_pairwise_paf.py` on the E. coli oracle: the two emit different
CIGARs for the same walks by design (`50I50D` against `50X`,
`HAPLOTYPE_WALKS_REVIEW.md:280-295`), nothing has compared them, and the gap
split that landed on 2026-09-06 made the display's clip the first consumer of
the CIGAR's interior.

Sample rows in the graph view are the same set question one surface over. Do
not rebuild that renderer for carriage — drawing a segment once per carrier
needs per-(node, carrier) positions and a renderer key other than node id, and
the result is the genotype matrix drawn as tubes, which a matrix display
already does at cohort scale. Give the cut a sample set (`keepHaplotypes` →
`GetSubgraph`) so the rows ARE the chosen haplotypes, keep first-visit-wins for
the shared nodes — with the cut holding only the chosen set that is nearly
attribution-free — and route carriage questions to the matrix.

**The interaction surface.** What shipped since: hovering a ribbon highlights
its whole ortholog group across every lane (`hoveredGroupKey`, main-thread
recolor); clicking one keeps the group's ribbons outlined through the pairwise
edge passes and opens the pair's details, surviving the refetch the widget's
own resize causes because the click stores the group KEY rather than an index
(2026-09-04, the worked example in
`mechanisms/ui-state-holds-keys-not-indices.md`); and the track menu carries
**Launch → Linear synteny view (visible region)** — the
`syntenyRegionMenuItems` dialog seeded from this track alone, which is the
"lane you want to drive independently" handoff. Lane order is
densest-first by default (`rowAssembliesOf` sums the placed group weight — one
per gene on a named table, anchor bp on an alignment source, so a lane whose
alignment breaks into two records does not outrank one that runs through —
over the fetched block set, not the viewport, so it holds still across a pan),
which is what the tutorial used to tell a reader to hand-author `rowOrder` for.

Since 2026-09-06 that launch seeds its panels from the display itself
(`lanePanelsForRegion`: one panel per lane in `rowAssemblies` order, framed on
what the lane places of the visible region on the contig its decision chose)
rather than the `SyntenyDiscoverMates` RPC over the dataset, and hands the
dialog `starAnchor` when the header named one: two mates take the anchor
between them, and a star with more offers **Repeat ⟨anchor⟩ between panels**
(on by default, 2N-1 rows, every band a direct pair) or names the bands that
will be empty without it.

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
down/Hide lane row, **Open ⟨assembly⟩ at the matching region** —
`openAssemblyInLinearView` on the lane's frame with this track and the genome's
annotation along, keyed so a second click re-navigates — and **Re-anchor on
⟨assembly⟩**,
which is `navToLocString` on the HOSTING view with the lane's assembly, since
the anchor lane reads off `lgv.assemblyNames[0]` and the old anchor drops into
a mate lane on its own. Both hops are dead while the lane places nothing or the
session does not hold the genome; the anchor lane's menu is the open-in-new-view
copy of the view region alone.

Two of those surfaces were doing more than they said (2026-09-05). A plain
click on a mate lane's label armed the drag and the release wrote the unmoved
order back, which pinned every lane, ended the densest-first sort and rebuilt
every cell; the drop now writes only an order that differs elementwise from
`rowAssemblies` (`laneOrderAfterDrop`), and the drop bar arms only past a few
px of travel. "Let the lane choose" after a pin was a no-op, since the released
contig went back in as the incumbent and the switch margin held it against a
comparable copy; a decision now records `pinned`, and an incumbent whose pin is
gone is no incumbent, so the lane votes fresh once. The SVG export also baked
the hover and the click into the paint and drew the group outline; it exports
with both ids zeroed and without `GroupHighlight`. Selection is still a
per-glyph recolour through the jexl slot rather than a per-draw id: the feature
glyph passes' shared uniforms (`featureGlyphUniforms.slang`) carry no
highlighted feature the way the synteny passes carry `hoveredFeatureId`, so
moving it there is a pass change, not a display one.

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

**Genome scale over an alignment-level source (2026-09-05).** Four things
stood between the display and a whole-chromosome human window on an indexed
PIF, and all four were the display's own. The ortholog fetch and the lane-link
fetch passed no `lodMode`, so a tiered file was always read at its fine tier —
at 10 kb/px a genome-wide fine fetch, the regime
[SYNTENY_LOD.md](../reference/SYNTENY_LOD.md) costs out; the display now has
LGVSyntenyDisplay's machinery whole (`lodMode`, `LodTierInfoMixin`, `lodTier`
off the settled zoom in `viewSignature`, the tier on both RPCs, the shared
"Level of detail" submenu gated on `trackHasLodTiers` and withdrawn once the
header's `hasCoarseTier` reads false, so a gene table sees none of it and a
star of headerless PIFs stops offering a switch that switches nothing). Bridging walked every nameless group down to the next lane that
placed it, and a one-record alignment has exactly one mate, so on an all-vs-all
file every anchor record whose mate was not lane 1 fanned across the gutters
over the direct links the pairs fetch for themselves; a bridge now needs a
group that can span lanes (`groupSpansLanes`: named, or carrying several
mates). The lane-genes and lane-link fetches folded every lane into one key and
reissued every lane when it moved, 44 tabix RPCs for a pan that moved one
lane's quantized window; each lane's held result now carries the region key it
was fetched under, the skeleton's predicate gate (`heldAnswers`) asks only the
stale lanes, and the rest keep their identity. And `laneGlyphCells` resolved the
`color`/`utrColor` jexl slots per gene per settle; `glyphColors` resolves them
per fetched set and the cells read the map. Same pass: a lane annotated through
a connection reads its annotation (`allSessionTracks`, the hop's own source),
and a star source — the HPRC vs-GRCh38 PAF, `MultiPairwiseSyntenyAdapter` —
gets its adjacent-pair links composed through the anchor (`composeLaneLinks`,
read by `pairLinks`) where the file states none: without a fetch when the
header names its anchor, after an empty pair fetch otherwise.

Two things on that fetch are still open. **The bytes.** Five of the eight
hosted hg38 liftOver PIFs predate the coarse tier, so the vertebrates star
serves fine detail at every zoom — 0.7-0.78 MB of CIGAR text per lane for one
300 kb window at TP53, parsed and walked in the worker to produce one clipped
extent — and the rebuild is worth 49× on a whole-genome pass, 1.31 MB against
64.23 MB over a 130 MB PIF
(`../measurements/pif-tier-wire-bytes.json`). Then let this display prefer
`coarse` whenever the star has it: it drops the CIGAR after the clip, and the
split it does ask for is at 10 kb, the coarse tier's own bound, so the cut is
the same on either tier and the fine tier buys it nothing but bytes — a
display-level default of `lodMode: 'coarse'` when `hasLodCapableAdapter` is a
two-line change. The coarse tier can never engage on a bacterial genome at the
default threshold (E. coli whole-chromosome is ~3.2 kb/px against a 10,000
threshold, [HOSTING.md](../reference/HOSTING.md)`:107-137`), so the E. coli case
is bounded by lanes, not bytes. **The pair fetch's tier and window.** It is
issued at the ANCHOR's tier over the upper lane's region (`model.ts:1069-1086`)
while that lane may be drawn at up to 80× the anchor's bp/px (`SCALE_LADDER`):
harmless for byte cost, wrong in principle for a tiered all-vs-all file.

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
edge, which is itself the information). The height story SHIPPED 2026-09-04:
below `MIN_LANE_PITCH` (22px, under the figure corpus's tightest committed
stack) the lanes stop dividing the height and scroll instead —
`laneContentHeight` in `laneStack.ts`, `scrollableHeight` through
`TrackHeightMixin`, the canvas display's `usePanelVirtualScroll` +
`VerticalScrollbar` wheel arbitration — so the 44-genome demo is readable at
the default height, and above the floor the layout is byte-identical to
before. The SVG export stays a viewport export at the current `scrollTop`,
which is the policy every virtual-scrolled display shares (the export
composition sizes each track's box from `display.height`); a full-stack export
would be a cross-cutting export-layout change. Two smaller height-adjacent
items are open: an auto-collapse for lanes placing nothing (the stacked view's
`collapseEmptyRows` has no lane counterpart, and `hiddenLanes` is purely
manual — the stability walk above shows 33/259 empty steps per lane), and a
user-guide section for the lanes UI, since the Lanes menu, the label drag and
`hiddenLanes` appear in no user-facing page and a 47-lane reader is never told
they can hide the Shigella lanes. `website/docs/user_guide.md` has no multiway
section at all: it links the two tutorials and stops, which is where that
section would go. The one other documentation gap the 2026-09-06 reading left
open is `GbzBaseSyntenyAdapter`, whose slots `pangenome_hprc.md` documents with
no config page behind them — the adapter lives in another repository, and
nothing the pangenome pages say about it is wrong. Ribbon color modes shipped
2026-08-27 as `ribbonColorBy` (`default`/`strand`/`identity`, **Color ribbons
by** on the track menu): a main-thread recolor off the synteny view's own
scheme and ramp, no refetch. Strand reads the RECORD — the two runs'
orientations against the anchor multiplied out, so between the anchor and
the first lane it is the record's strand and between two mate lanes it is
their relative strand — and not the drawn twist: a lane whose every placement
is inverted is drawn flipped, so its ribbons run straight on screen while
every one of them is an inversion, and the color says so where the twist
cannot (`ribbonColorer` in `multiwayGeometry.ts`; the flipped-lane case is
pinned in `multiwayGeometry.test.ts`). The 2026-08-27 entry here said the
opposite, and the slot doc and the hg38 tutorial repeated it, until
2026-09-06. Identity reads the group feature's `identity` (a pair without one keeps the slot color — the synteny view's missing-value red would read as a value here), which on an
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
packs each lane into two cells in the stack's px, offset into the passes'
unsigned coordinate by `PX_ORIGIN`, so a lane's `bpRangeX` uniform is a px
range and the drag is the only per-frame input.

**Don't restate that track's rules — take them, and let the test say so.**
`geneGlyphParity.test.ts` runs one gene through `buildFeatureRenderData` and
through `buildLaneCells` and compares; it is insensitive to what the shared
constants ARE and fails the moment either side keeps a copy of one. It exists
because the hand-matched version drifted in four places at once while every
expected value in the directory stayed green: `line`/`arrow` take a box CENTRE
where `rect` takes its top, the connector is one line per intron gap (the
chevron pass spaces marks along each line it is handed), `outlineColor` is a
per-CELL uniform — which is why the placement boxes get a `boxes:<row>` cell of
their own and the gene cell carries no outline, the feature track's own default
— and the subpart tests are `isCDS`/`isExon`/`isUTR` rather than `type ===`.
What the lanes still own is the merge across transcripts: the feature track is
per-transcript everywhere and its container glyph emits nothing of its own, so
there is no counterpart to lift.

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
launch tour (`multiway_launch_stack`) filmed that row being unticked, and no
longer does: the dialog prints brachypodium at 176 kb against rice's 170,
sorghum's 178 and setaria's 166, so the step dropped a good panel while saying
it was out of scale. Maize is the wide row now at 454 kb and is deliberately
NOT the replacement — the set exists partly to show maize's WGD, so unticking
it would teach the reader to discard the finding. The display groups on gene name with `syntenyId` as
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

What none of those specs does is assert anything beyond the ready phase
(`website/scripts/generate-screenshots.ts:160-196`), so a figure that draws the
wrong thing still ships. Both ways that has happened were caught by a human
re-reading the pictures rather than by a check: `hprc_lane_menu` was shot
against a PIF the next day's rebuild replaced, and
`hg38_vertebrates_17p_break` drew a lane `[rev]` at a rung the code had stopped
choosing — see
[../reference/MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md)
§4.10, which records both and the 2026-09-09 reshoot that fixed them.

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

**More than one row per genome, and which of the four routes to build.** A lane
hosts one annotation chosen by rank and nothing else, so a reader who wants a
second track on some genome has only the two escape hatches — open the lane in
its own unsynchronised LGV, or launch a `LinearSyntenyView`, both costed in
[../reference/MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md)
§2.3. Four ways out were weighed. (1) Let a lane host tracks, a
frame-projected track container per lane: large, and it recreates the deleted
`MultiLGVSyntenyDisplay` (`884a126861`, ~4,000 lines) by another route — leave
it alone. (2) The stacked launch with the anchor REPEATED between every pair of
mates, since `views` may name one assembly twice and `[m1, anchor, m2, anchor,
m3]` makes every level a direct pair on a star: landed 2026-09-06 as **Repeat
⟨anchor⟩ between panels**, 2N-1 rows, every band a direct pair. (3) A hub
layout in `LinearSyntenyView`, every level anchored on a designated row: a
level is the gap between `views[i]` and `views[i + 1]` in ten files, so this is
a view redesign — leave it alone. (4) A **synced per-lane view**: the existing
"Open ⟨assembly⟩ at the matching region" made to FOLLOW the lane's frame. A
lane decision is already a `{pivotAnchor, pivotLaneBp, rung, flipped}` and
`SyntenyFollow` already navigates a real LGV from pairwise data, so this is the
product answer and the one still to build — the lane stack stays the overview
and the drill-down is a full LGV that tracks the lane.

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

A group a lane places twice was one sample over the two copies' bounding box,
weighted by its width, so two copies 300 kb apart outweighed the collinear
genes and the weighted median slid the lane to put the gap under the anchor
gene; since 2026-09-05 each run is its own placement at its own length
(`LanePlacement`), the orientation vote skips pairs within one group, and the
lane below aligns to the heaviest run. The same day the lane genes came out of
`buildLanes`: only the glyph cells read them, and a stack that carried them
gave the ribbon and tick cells a new identity on every gene commit — every
ribbon re-uploaded and the hover cleared for a commit that moved no ribbon.

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

_Generated by `pnpm autogen` — edit the source, not this block._

| lane        | contigs seen | contig chg | contig osc | drawn flip chg | drawn flip osc | fallback flip chg | fallback flip osc | empty steps | rung chg | rung osc | slip steps | median slip px | max slip px |
| ----------- | -----------: | ---------: | ---------: | -------------: | -------------: | ----------------: | ----------------: | ----------: | -------: | -------: | ---------: | -------------: | ----------: |
| peach       |            2 |          3 |          0 |              5 |              0 |                10 |                 2 |          33 |        7 |        0 |         23 |            298 |       4,705 |
| citrus      |            3 |          8 |          0 |              7 |              0 |                13 |                 3 |          33 |        2 |        0 |         22 |            148 |         607 |
| cacao       |            2 |          4 |          0 |             12 |              3 |                17 |                 2 |          33 |       13 |        0 |         64 |             64 |      24,234 |
| poplar      |            5 |          8 |          0 |              9 |              2 |                14 |                 3 |          33 |        4 |        0 |         60 |             64 |       3,596 |
| tomato      |            4 |          8 |          0 |             14 |              2 |                12 |                 3 |          33 |        7 |        0 |         42 |             80 |         852 |
| arabidopsis |            4 |          8 |          0 |              9 |              2 |                15 |                 5 |          34 |        2 |        0 |         61 |             64 |         640 |

<!-- END GENERATED MEASUREMENT multiway-lane-stability -->

That is the 2026-09-06 run, after `orientationVote` changed to every pair
weighed by the product of group weights, and it is worse than the run before
it. The 2026-09-02 table had drawn flip changes of 3, 4, 5, 7, 8 and 2 (peach,
citrus, cacao, poplar, tomato, arabidopsis) and every `osc` column zero; this
one has 5, 7, 12, 9, 14 and 9 with drawn flip oscillations of 0, 0, 3, 2, 2
and 2. The attribution is exact rather than inferred: the same bundle with the
neighbour rule patched back into it reproduces the 2026-09-02 numbers to the
digit, so nothing else that landed that day moved them. Contig, rung and
fallback columns are unchanged; the slip columns moved because fewer steps
sit on one orientation to be counted. The reason is the weight: on a gene
table every group weighs one, so the product vote is a plain concordance over
every pair of shared genes, and a paleopolyploid lane holding two interleaved
blocks reads close to even under it — the near-tie the deadband was built to
hold — where the neighbour rule read each block's run. The vote earned its
change on an alignment source (calJac4's chain, below), and this is what it
costs on a gene table; a weight that reads the block on both would be the
fix, and the 2026-08-26 paragraph after this is the bar it has to clear.

What was true of the 2026-09-02 table, kept because it is the bar: the drawn
flip changes that remained (3 to 8 per lane) were lanes moving between
syntenic blocks and staying; the `fallback` columns are what the anchor-order
sum alone would do, kept as the control. The stateless version of the same
walk had 1 to 7 flip oscillations per lane and 10 to 21 flip changes, and
arabidopsis changed contig 12 times with 3 of them oscillations. `empty` is
windows where the lane places nothing at all, the same 33 for every lane, and
no rule can fill them. `slip` is how far a lane's content moved on screen
beyond the anchor's own pan, counted only on one contig, orientation and rung:
a held lane slips 0, and each re-alignment is one slip. The medians are the
ordinary re-alignment; the maxima are the kept cluster hopping to another
paleo-block on the same contig, which is a relocation the way a contig change
is.

**What the vote reaches on a pairwise source, checked against the raw rows
(2026-09-06).** The 17p figure (`multiway_synteny/hg38_vertebrates_17p_break`,
hg38 chr17:15,200,014-16,400,014 over eight liftOver PIFs) marks five lanes
[rev]. `multiwayOrientation17p.probe.ts` reads the same window through the
same adapter with the display's fetch options and runs `decideLaneFrames`
with no incumbent, which is the figure's own state, and puts beside each
lane's answer the anchor bp of its placements on the drawn contig by record
strand:

<!-- BEGIN GENERATED MEASUREMENT multiway-17p-orientation -->

_Generated by `pnpm autogen` — edit the source, not this block._

| lane     | contig | drawn   | fallback | shared groups | all-pairs bwd | neighbour bwd |      + bp |      - bp | majority |
| -------- | ------ | ------- | -------- | ------------: | ------------: | ------------: | --------: | --------: | -------- |
| calJac4  | chr5   | forward | [rev]    |            46 |         0.019 |         0.688 |   582,085 |   597,199 | - 0.506  |
| panTro6  | chr17  | [rev]   | [rev]    |             0 |      abstains |      abstains |    27,123 | 1,168,258 | - 0.977  |
| gorGor6  | chr5   | [rev]   | [rev]    |             0 |      abstains |      abstains |         0 |   644,668 | - 1.000  |
| ponAbe3  | chr17  | forward | forward  |             0 |      abstains |      abstains | 1,147,002 |    22,332 | + 0.981  |
| rheMac10 | chr16  | forward | forward  |             0 |      abstains |      abstains |   583,055 |   593,900 | - 0.505  |
| canFam6  | chr5   | [rev]   | [rev]    |             0 |      abstains |      abstains |   527,509 |   576,664 | - 0.522  |
| bosTau9  | chr19  | [rev]   | [rev]    |             0 |      abstains |      abstains |   480,205 |   523,228 | - 0.521  |
| mm39     | chr11  | forward | forward  |             0 |      abstains |      abstains |   440,288 |   487,063 | - 0.525  |

<!-- END GENERATED MEASUREMENT multiway-17p-orientation -->

Two things the table says that the commit did not. First, `shared` is zero
below the top lane: a pairwise record is a group with one mate, so a lane
shares no group with the lane above it and the vote abstains on every lane
but the first — seven of the eight marks are the anchor-order fallback, and
the vote change touched only calJac4. Second, calJac4 is that top lane, and
the code draws it forward (0.019 of the paired evidence backwards under the
product rule, 0.688 under the neighbour rule it replaced, and the fallback
says [rev]) while the committed figure shows it [rev]: the re-shoot in
`05ec50660e` ran against a build that predated the vote, and the figure is
stale until the next render. Against the raw strands, panTro6 (0.977 on `-`)
and gorGor6 (1.000) are [rev] on a clear majority; canFam6 (0.522) and
bosTau9 (0.521) are [rev] on a slim one; rheMac10 (0.505) and mm39 (0.525)
draw forward against a slim `-` majority; calJac4 (0.506) is even. Five of the
eight lanes sit within three points of even, and for those the mark is the
rule's choice and the hysteresis's hold, not a fact of the data — which is
why the deadband exists, and why the drawn direction of a near-even lane
should not be read as a claim.

**What it took, beyond the deadband.** The contig vote was steady before any
incumbent — weighting a contig by how much of the ANCHOR it explains is
decisive on paleopolyploid data — and the orientation was not: both of its
votes moved in the same places, so overriding one with the other bought
nothing. The deadband alone did not close it either. The last oscillations came
from a contig change resetting the orientation to the anchor-order fallback,
which the vote then corrected a step later, and from three reversed genes
mirroring a whole lane. The rung had an oscillation of its own, since the
cluster `keepNearMedian` keeps is a discrete choice too.

**Anchor bp is the wrong weight for a gene table (2026-09-02).** The vote
above was measured on grape, where it was steady, and it is still the right
weight for an alignment source: a 2 Mb block has to outweigh twenty repeat
hits. On a gene-symbol table over eight primates it put the chimp lane on
chr2B at a 3 Mb window across the human chr2 fusion because _DPP10_ alone is
1.5 Mb of anchor, against 0.4 Mb for the fifteen orthologs on chr2A — and
chr2A did not reach the `alsoOn` bar either. `MultiWayGroup.weight` now
carries the evidence per group: anchor bp for a nameless record, one per gene
for a named one, and `resolvePanel` votes with the same rule so a launched
panel still opens on the lane's contig. The rule is `voteEvidence` in
`syntenyHysteresis.ts` since 2026-09-04, when the synteny follow's envelope
vote — the third voter over the same data — turned out to still weigh anchor
bp; a cross-import test in `followWindowMapping.test.ts` now pins all three to
one contig. `ALSO_ON_SHARE` dropped from a half to
a fifth with it, so the far side of a breakpoint stays named through most of
a walk across it. The grape stability walk was re-run after the change, and
that 2026-09-02 run is the one the paragraph under the table quotes as the bar.

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

**What the tests do not pin (2026-09-06).** Every fixture in the display's
directory is two or three mate lanes and a handful of groups. Nothing
exercises: a star of ≥3 mates with mixed orientations end to end (ribbon
colour, composed links and headers together); composed links against a CIGAR
oracle; ordering semantics for a nameless source; `laneGeneAdapters` cost or
correctness with hundreds of tracks; a window on a lane whose record carries an
interior gap; the picker above ~10 lanes; anything at 44 or 464 lanes beyond
the height assertion.
[../handoffs/multiway-graph-native.md](../handoffs/multiway-graph-native.md)
("Smaller items") adds a hung lane fetch holding the first-load phase at
`loading` with no deadline.

One of those gaps is a near-miss worth its own sentence.
`SyntenyFeature.get('name')` answers the mate's refName when the record has no
name (`plugins/comparative-adapters/src/SyntenyFeature/index.ts:34-35`), and
the clipped copy is a `SyntenyFeature` (`clipFeatureToRegion.ts:107`). Had that
object reached the display, every star record would be "named" by its mate's
contig, `featuresAreNameless` would be false, and `groupFeatures` would fold
every gorilla-chr17 and chimp-chr17 record into one group drawn as a chain. It
does not reach the display: `CoreGetFeatures` returns `f.toJSON()` and rebuilds
plain `SimpleFeature`s (`packages/core/src/rpc/methods/CoreGetFeatures.ts:16,46`),
and the getter is not data. So the display's "is this source an alignment" test
rests on a serialisation boundary that no test names.

**What not to touch.** The 2026-09-06 reading ends with a list of what it found
sound and would not have anyone reopen: the lane decision and its hysteresis;
the cell/layer renderer and its parity tests; the gene glyph parity with the
canvas track; the per-lane staleness on the dependent fetches; the lane picker
at its current scale; and the E. coli and primate demos as they stand.
