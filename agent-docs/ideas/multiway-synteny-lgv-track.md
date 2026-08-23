---
name: multiway-synteny-lgv-track
description: Follow-ups to the multi-way synteny LGV track — per-base alignment lanes, the selection-scan pairing demo, multi-copy and self-comparison lanes, HPRC-scale lane selection and placement providers, and the interaction surface rowOrder still lacks. Read before extending MultiWaySyntenyDisplay or proposing a demo on it.
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
records. The tutorial is `multiway_synteny_lgv_track.md`. What follows is what
was deliberately NOT built, with the reasoning that shaped each cut.

**Per-base alignment lanes (CIGAR in row-local frames).** The most-wanted
extension and the wrong one to bolt onto this display. The SVG path draws
tens-to-hundreds of glyphs; per-base mismatch rendering at LGVSyntenyDisplay
density is worker-emitted GPU geometry, and every existing emitter
(`buildSyntenyGeometry`, the alignments packers) emits into reference-anchored
or view-pair frames. Row-local lanes need the worker to emit into each mate's
own frame — a frame the MAIN thread computes from the fetched placements, so
either the frame computation moves worker-side or the frame rides into the RPC
as part of the request key (and then every frame re-fit is a refetch; see the
follow-snap-grid refetch entry in [synteny-comparative](synteny-comparative.md)
for how that cost behaves). Treat it as a fourth backend consumer of the
synteny GPU stack, not as a change to this display.

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
which is the "lane you want to drive independently" handoff. Still missing:
`rowOrder` has no UI (a track-menu lane editor or drag on the lane labels),
and the label is the obvious home for per-lane actions — hide a lane, open
that assembly in its own LGV (`LaunchLinearGenomeView` exists), re-anchor the
whole track on that lane's assembly. Ribbon color modes (strand for
inversions, identity from the PAF's `de:f:`) fit the existing `ribbonColor`
slot as a colorBy the way `syntenyColors.ts` does it — main-thread recolor, no
refetch. Per-lane pan/zoom stays deliberately absent: the lanes re-fit to the
anchor's viewport by design, and the launch above is the route to a lane you
drive yourself.

**Gene glyph rendering.** The lanes draw the canvas gene track's geometry
(merged CDS full height, exon-minus-CDS thinner in `utrDefaultColor`, intron
chevrons, a downstream arrowhead, direction resolved in pixel space so flipped
lanes point the way they read) as main-thread SVG through `geneGlyphShape`.
Deliberately basic: the likely future is a GPU-emitting backend (see per-base
lanes above), and the parts that transfer are the interval math and the model
state, not the SVG. Don't invest in the SVG path beyond what a figure needs.

**Cross-row identity.** The display groups on gene name with `syntenyId` as
the nameless fallback; the first-class `syntenyGroupId` this approximates is
specified in [synteny-comparative](synteny-comparative.md) §"syntenyGroupId for
cross-row block identity" and should be built there, not here — this display
becomes its third consumer, after colorBy:group and cross-row hover in the
synteny view.
