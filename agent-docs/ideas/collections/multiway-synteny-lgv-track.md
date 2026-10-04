---
name: multiway-synteny-lgv-track
description: Follow-ups to the multi-way synteny LGV track — per-base alignment lanes, the selection-scan pairing demo, multi-copy and self-comparison lanes, HPRC-scale lane selection and the cohort hand-off, the graph data path, the synced per-lane view, the remaining LOD and byte work, and what the tests do not pin. Read before extending MultiWaySyntenyDisplay or proposing a demo on it; how the display works today is reference/MULTIWAY_SYNTENY_DISPLAY.md.
---

# Multi-way synteny LGV track follow-ups

How the display works — the lane stack and its frames, the adapter contract,
the cost of a lane at 8, 64, 464 and 4,000, the two named tutorials and the
correctness findings that have landed — is
[../../reference/MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md),
whose landed block names what not to re-fix and whose §6 holds what was
measured and settled. What follows is what was deliberately NOT built, with the
reasoning that shaped each cut, and what is still open.

**The selection-scan pairing demo.** The storytelling shape the E. coli figure
proves — a quantitative signal above, the lanes naming which genomes explain it
below — has no hosted GWAS/Fst/selection wiggle sitting on the same anchor as a
multi-genome track. The demo worth building is the one that recreates the
figure this whole track was pitched from (Jiao & Schneeberger 2020, Fig 3d):
Arabidopsis accessions with a diversity or selection statistic over Col-0 plus
per-accession assemblies and annotations. Candidates in order of data
readiness: Arabidopsis 1001/MPIPZ accession assemblies (annotations exist,
statistic must be computed), Dog10K (the parked 4-5 hour wolf-ancestry sweep in
[figures-blocked-on-data](../waiting-on-someone-else/figures-blocked-on-data.md) would BE the top panel, but there
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
rather than as `TreeSidebarMixin`: `laneFilter` (a session property, so a
shared session carries it; the track's own `assemblyNames` is what a hosted
track opens on) narrows `rowAssemblies`, and for a source whose header declares
its lanes the selection also rides the fetch as `haplotypes`
(`fetchLaneSelection`). The universe the picker offers is the
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
[../../reference/MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md)
§5.2. The scaling story is two surfaces with a hand-off between them, in three
steps:

1. **A genotype-first picker** over the cohort: the `pgbi.vcf.gz` per-allele
   VCF (462 haplotypes of `GT`, 1.7 s for a 70 kb window remotely,
   [PANGENOME_GRAPHS.md](../../reference/PANGENOME_GRAPHS.md) "Release 2 files
   nothing here reads yet") or the wave VCF through
   `LinearMultiSampleVariantDisplay`, with `TreeSidebarMixin`'s
   cluster-by-identity ordering; rows at 1-2 px each, 464 or 4,000 of them; a
   click or a lasso yields a haplotype set.
2. **This display as the locus reading** for that set: the set becomes
   `laneFilter` (session state already), and — once the reader takes a
   filter — the fetch.
3. **The graph view** taking the same set: `haplotypes` on `GetSubgraph`
   (`HAPLOTYPE_WALKS_VISION.md:70-73`), Sample rows drawing the chosen set.

Two smaller things go with that and are worth doing before anyone opens a
hundred lanes: make a graph source require a lane set — the track's
`assemblyNames` is already how `demos/hprc_multiway` opens on eight, and "every
lane the source places" should not be the default when the header declares more than, say, 32,
which is a refusal with the picker open; cull scrolled-out layers in
`renderLayers`. `laneGeneAdapters`, once listed as a third, has been a one-pass
join since 2026-09-12. The picker dialog
itself is fine to ~500 and should not be made to scale further.

The ORDER of whatever set that picks is its own file —
[ordering-synteny-lanes-by-similarity](../waiting-on-a-call/ordering-synteny-lanes-by-similarity.md),
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
tables for HPRC (the all-vs-1 PAFs in [HPRC_RELEASE2.md](../../reference/HPRC_RELEASE2.md)
are anchor-shaped already; a live transitive DFS over PIF was rejected as
round-trip-bound in [synteny-comparative](synteny-comparative.md)), and
GAF-annot (jmonlong's vg annotate route) as an annotation provider — one
artifact for all haplotypes, resolvable locus→node-ids→GAF through the
`segs.bed.gz` index as a two-stage tabix, with the caveat that per-haplotype
walk offsets are exactly what the 19x-smaller reference-keyed index dropped
([PANGENOME_GRAPHS.md](../../reference/PANGENOME_GRAPHS.md)).

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
against [`gfa_to_pairwise_paf.py`](https://github.com/cmdcolin/gfa-to-pairwise-paf) on the E. coli oracle: the two emit different
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

**Ribbons across a skipped lane in the stacked view.** The display bridges a
lane that places nothing for a group (`bridgeSkippedLanes`). The stacked
`LinearSyntenyView` has the same gap and no such fix: a level is defined as the
gap between `views[level]` and `views[level + 1]` in ten files, so a track that
joins row 0 to row 2 across row 1 is a level with a span, not a setting.

**The bytes at a zoomed-in star.** The eight hosted hg38
liftOver PIFs carry a coarse tier since their 2026-09-11 rebuild, worth 49× on a
whole-genome pass (1.31 MB against 64.23 MB over a 130 MB PIF,
`../../measurements/pif-tier-wire-bytes.json`), but at TP53 zoom the star still
reads the fine tier: 0.7-0.78 MB of CIGAR text per lane for one 300 kb window,
parsed and walked in the worker to produce one clipped extent. Serving `coarse`
there is a trade, not a two-line change: the 10 kb gap cuts come out the same,
since the coarse tier keeps every indel over half its bound, but a record
crossing the window edge is clipped by walking whichever CIGAR the row carries
(`clipFeatureToRegion`), and a coarse run is only within 10 kb of the true path
— about 50 px at the TP53 window. The coarse tier can never engage on a bacterial genome at the
default threshold (E. coli whole-chromosome is ~3.2 kb/px against a 10,000
threshold, [HOSTING.md](../../reference/HOSTING.md)`:107-137`), so the E. coli case
is bounded by lanes, not bytes. The pair fetch asks at the ANCHOR's tier over
the upper lane's region (`laneLinksFetchSpecs`), and that is never wrong
output: `SCALE_LADDER` only zooms a lane out, so an anchor past the coarse
bound puts every lane past it too, and the worst case is fine bytes a lane
could have skipped. No hosted source pays even that — the E. coli all-vs-all
files have no coarse tier, and the HPRC PIF holds no mate-versus-mate rows.

**Collinear runs as block ribbons.** Collapsing collinear runs into block
ribbons (DAGchainer's chaining, per lane pair — walk the shared groups in the upper
lane's order and extend a run while the lower lane's rank advances by one in the
same direction). Most ribbons are individually thin and
collectively collinear, and one band per run would cut both the clutter and the
svg node count. It is parked because it changes what a ribbon IS: hover reads
one ortholog group today, and a run either becomes the hover unit or has to
carry its members. Drawing blocks only below a zoom threshold was declined
on 2026-09-21: ribbons switching between blocks and genes at the threshold read
as flicker now that lane moves animate. Lane ordering could also use it — seed with the densest lane,
then append whichever unused lane shares the most collinear runs with the last
one placed, which shortens the travel without giving up the density-first
property that keeps chains running.

Still open: a **Match anchor scale** mode (one line in `computeRowFrame` — every
lane's span is the anchor's, and content that does not fit runs off the lane
edge, which is itself the information); an auto-collapse for lanes placing
nothing (the stacked view's `collapseEmptyRows` has no lane counterpart, and
Hide lane is purely manual — the stability walk below shows 33/259 empty steps
per lane); and a user-guide section for the lanes UI, since the Lanes menu, the
label drag and Hide lane appear in no user-facing page and a 47-lane reader is
never told they can hide the Shigella lanes. `website/docs/user_guide.md` has
no multiway section at all. `GbzBaseSyntenyAdapter`'s slots are documented by
`pangenome_hprc.md` with no config page behind them, because the adapter lives
in another repository. Per-lane pan/zoom stays deliberately absent: the lanes
re-fit to the anchor's viewport by design, and the launch to a linear synteny
view is the route to a lane you drive yourself.

**A synced per-lane view.** A lane hosts one annotation plus the layers
[ADR-180](../../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md)
draws through its frame, so a reader who wants a real track on some genome has
the two escape hatches costed in
[../../reference/MULTIWAY_SYNTENY_DISPLAY.md](../../reference/MULTIWAY_SYNTENY_DISPLAY.md)
§2.3. The one still to build is "Open ⟨assembly⟩ at the matching region" made
to FOLLOW the lane's frame. A lane decision is already a
`{pivotAnchor, pivotLaneBp, rung, flipped}` and `SyntenyFollow` already
navigates a real LGV from pairwise data, so the lane stack stays the overview
and the drill-down is a full LGV that tracks the lane. A hub layout in
`LinearSyntenyView`, every level anchored on a designated row, is a view
redesign — a level is the gap between `views[i]` and `views[i + 1]` in ten
files — so leave it alone; the repeated-anchor launch (**Repeat ⟨anchor⟩
between panels**) covers the star.

**What the tests do not pin (2026-09-06).** Every fixture in the display's
directory is two or three mate lanes and a handful of groups. Nothing
exercises: composed links against a CIGAR oracle; ordering semantics for a
nameless source; `laneGeneAdapters` cost or correctness with hundreds of
tracks; a window on a lane whose record carries an interior gap; the picker
above ~10 lanes; anything at 44 or 464 lanes beyond the height assertion.

