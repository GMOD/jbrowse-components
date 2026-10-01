---
name: multiway-synteny-display
description: What MultiWaySyntenyDisplay is — the lane stack and its frames, the adapter contract, the two tutorials it serves, its cost per lane, and its ceiling for graph pangenomes. Read before changing its placement, ordering, LOD gating or launch route.
kind: spec
---

# MultiWaySyntenyDisplay: what it is, what it costs, where it stops

MultiWaySyntenyDisplay is a per-window, anchor-star, one-affine-frame-per-genome
lane stack that lives inside an ordinary LinearGenomeView. This file is the
settled reading of it: the data model, the adapter contract, the two tutorials
that ship on it, the cost of a lane, the correctness findings that have landed,
and how far the frame carries toward a graph pangenome. What is still unbuilt or
undecided — per-base lanes, the cohort-scale surfaces, the graph data path, the
test gaps — lives in
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md),
which is also the design record this file cites by section name.

Paths: `JC/` is `~/src/jbrowse-components`, `P/` is
`~/src/jb2plugins/jbrowse-plugin-graphgenomeviewer`, `G/` is
`~/src/gmod/gbz-base-js`. The display is
`JC/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/`, abbreviated
`MW/` below, and cited by symbol rather than line, since its line numbers move
with every change. The plugin's `agent-docs/` no longer holds
`GBZ_PLAN.md`, `GBZ_HANDOFF.md`, `HAPLOTYPE_WALKS_REVIEW.md` or
`HAPLOTYPE_WALKS_VISION.md`; citations to them below are historical and their
line numbers point at nothing current. Every measurement here was either taken against the hosted
data or is cited to the file that records it.

## Findings that have landed — do not re-fix them

Re-checked against the code and every tutorial the display appears in.

- **4.1**, alignment records drawn as affine blocks. `SPLIT_AT_GAP_BP = 10_000`
  (`MW/afterAttach.ts`) rides both the anchor fetch and the pair fetch and is
  honoured through `clipFeatureToRegion`, so a record is cut at every large
  indel and the hg38 page documents the cut rather than the artefact. Inside a
  run the affine placement is gone too: every gutter now draws the record's own
  ops, the anchor's from the record itself and a lower one's composed from the
  two records it sits between (`composeAlignmentOps`), which also places the
  composed stretch exactly instead of interpolating the record's overall ratio.
  Mismatches sharing a pixel draw as one mark carrying their mismatched length,
  so the marks are bounded by the ribbon's width in px and the width fade reads
  as density.
- **4.2**, the two strand semantics. `configSchema.ts`, the `Color ribbons by`
  help text and `multiwayGeometry.ts` now all say the record's strand and not
  the drawn twist; the four tutorials that stated the crossing were corrected
  on 2026-09-07.
- **4.3**, densest-first rewarding fragmentation. `rowAssembliesOf` ranks a
  lane by the group weight on its heaviest contig.
- **4.4**, the star launch. `lanePanelsForRegion` seeds the dialog's panels from
  the display's own lanes, the header's anchor rides along as `starAnchor`, two
  mates take the anchor between them, and a star with more offers **Repeat
  ⟨anchor⟩ between panels** — on by default, 2N-1 rows, every band a direct pair
  (`lanePanelsForRegion`; `LaunchSyntenyView/buildSyntenyViewSpec.ts:63`, `:99`;
  `LaunchSyntenyViewForRegionDialog.tsx:259`, `:271`). §"The interaction
  surface" in the ideas file records the same landing; §2.2 below describes the
  route as it stood before it.
- **2.2**, the LOD menu on a source with no coarse tier. The gate withdraws the
  entry off the header, pinned by `lodMenuGate.test.ts`.
- **4.8** in part: the grape page's "no GFF3"; `hprc_multiway_synteny.md`'s
  Lanes submenu, which documented it without `Show all lanes` and `Reset lane
  order` (now `sectionOrderMenuItems`); and the figure-manifest gap for six multiway
  figures the docs reference are all closed. `user_guide.md` still has no
  multiway section, and `GbzBaseSyntenyAdapter` still has no config page (it is
  out-of-repo, and nothing the pangenome pages document about it is wrong) —
  both are open in the ideas file.
- **4.10** and **4.11**, added by the 2026-09-07 re-read and both closed since.
  The reshoot landed on 2026-09-09 and `hprc_lane_menu` and
  `pangenome/hprc_cfh_haplotypes` now stack their haplotypes the same way;
  `ComparativeAdapterBase` emits its per-region streams in region order, pinned
  by a test in `clipFeatureToRegion.test.ts`; and `pickContig` caps `alsoOn` at
  `ALSO_ON_MAX = 3` with the remainder counted in `alsoOnMore`
  (`MW/laneDecision.ts`). §4 below carries what each found.
- **The 2026-09-20 review**, landed 2026-09-21. A re-anchor no longer carries
  the old genome's pivot and flip: the ortholog answer is held beside the
  anchor its fetch asked for and reads as absent under any other
  (`fetchedFeatures`, pinned by `reanchor.test.ts`). A lane's baseline is its
  contig's extent where the session has loaded that genome (`Lane.baseline`).
  Gene colour is the `FeatureColor` channel, with a `cluster` field that paints
  a gene by the ortholog group it carries (`MW/geneColor.ts`). One lane's gene
  commit repacks that lane alone, 2 of 90 cells where it had been 90
  (`laneGeneCommitCost.test.ts`). **Flip lane** pins a lane's orientation
  (`pinnedLaneFlips`), and a same-contig re-decision moves the lane rather
  than snapping it (`MW/laneMotion.ts`).

- **The 2026-09-24 review.** A star's tied lanes no longer reorder with
  network arrival order; a star declares its lanes and reads only the chosen
  children; lanes, their menus and the picker name a genome by the session's
  display name, else a plugin's description, else the source's declared label;
  `laneGeneTracks` names each
  lane's gene track; a lane sharing fewer than three groups with the lane above
  votes and aligns against the anchor, which on a star is every lane below the
  first (the 17p and stability records under the ideas file); and the picker
  greys only a lane the window was asked for and placed nothing.
- **The 2026-09-27 placement pass.** A rung covers a fit up to 10% wider than
  itself (`RUNG_TOLERANCE`), so the liftOver lanes that overran the TNNT3 and
  TP53 windows by 1.6-7.5% draw at 1× rather than 1.5×. The alignment shift is
  unclamped (`alignFrameTo`), so a lane lines its homologs up under the
  anchor's even where that leaves part of its fit off an edge or starts its
  frame below zero; the header, ticks and gene fetch stop at zero. The hold
  compares against what a fresh alignment would show, and the lane order ranks
  each lane by its heaviest contig (§4.3). The anchor seed a lane aligns on,
  `anchorAbsX`, is the centre of what the viewport shows of each group, the
  same cut as the lane's runs; seeded at the whole record's centre, the HPRC
  CFH haplotypes, each a few long records running past the window, slid about
  75 px toward their overhang once the shift was unclamped.

Still open, and carried in
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md):
**4.9** (what the tests do not pin) and the remainder of **4.8**.

## The verdict in one paragraph

The display's data model is one ortholog/alignment fetch on the anchor, a group
per anchor feature with one placement list per mate assembly, and one lane per
mate assembly drawn in a frame `{contig, flipped, rung × anchor span, pivot}`
decided once per settle. That model is exactly right for what the two named
tutorials use it for: a gene table over 44 bacterial genomes and a star of eight
pairwise alignments over one human locus. It is the wrong frame, unmodified, for
three things: more than one row of content per genome (a lane is a
display-internal object that hosts one annotation and nothing else), alignment
sources whose within-record structure matters (at TP53 a 25 kb mouse indel drew
as a straight ribbon until the gap split landed; a direct gutter now tiles its
record's matched stretches and leaves every indel open, the synteny view's
Transparent indels, so an indel under `SPLIT_AT_GAP_BP`'s 10 kb and one over it
read alike), and cohorts of hundreds to thousands of haplotypes (every cost is
linear in lanes, the picker is a flat checkbox list, and the graph fetch is the
whole cohort regardless of the selection). The row-per-haplotype picture should
be kept as the *reading* for a chosen handful; the *choosing* and the *fetching*
need a different surface and a different data path, and both are already
sketched in the plugin's vision documents.

## 1. What the display actually is

### 1.1 The data model

**One fetch.** `fetchPhases` in `MW/afterAttach.ts` issues one
`MultiWayGetFeatures` over the anchor's merged static blocks with
`opts: { mateShape: 'grouped', lodMode: lodTier, clipToRegion: true, splitAtGapBp }`
and no `targetAssemblyName`, so the adapter answers with every pair anchored on
the queried assembly. That RPC is `CoreGetFeatures` with each piece's packed
alignment ops lifted out of the feature and returned beside it by id, so the
features the display holds are plain data: a details panel freezes and a
session stringifies what it is handed, and neither can hold a typed array. The lane selection reaches the fetch as `haplotypes` only
for an adapter that declares its lanes (`fetchLaneSelection`), since that is the
only kind that can answer for a subset more cheaply than for all of them;
everywhere else `laneSelection` filters `rowAssemblies` locally. Before a
reader chooses, a lane-declaring source opens on the track's own
`assemblyNames` beside the anchor (`configuredLanes`). The design record carries what a lane selection
saves on a graph source
([../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"HPRC at scale: lane selection"; `P/agent-docs/GBZ_PLAN.md:297-301`).

**Groups.** `groupFeatures` (`MW/layoutMultiWay.ts`) folds features into
`MultiWayGroup { key, anchor, mates: Map<assembly, MatePlacement[]>, feature, weight }`.
The key is `name`, else `syntenyId`, else `feature.id()` (`groupKeyOf`), so a
named table (MCScan blocks, gene-symbol join) chains a gene across every lane,
while an alignment source makes every clipped record its own group. The clip
also cuts a record at every indel of `splitAtGapBp` or more
(`splitSyntenyFeatureAtGaps`), and each gap-free run is its own group: runs as
placements of one group would draw a cross product, because the gutter draws
every anchor span of a group against every mate span. A mate's
`orientation` is the *pair's* strand (`MatePlacement`), never the mate object's
strand. `weight` is anchor bp for a nameless record and one per gene for a named
one (`voteEvidence`).

**Lanes.** `rowAssembliesOf` orders mate assemblies by the summed group weight
on each lane's heaviest contig — the evidence `pickContig` votes with — over
the whole fetched block set, then pins `domain`; the model's `rowAssemblies`
keeps the lanes `laneUniverse` marks `drawn`, compared on canonical names
(`laneKey`).
`laneFilter` holds the reader's choice as `{ only }`, which the picker writes and
which replaces `configuredLanes` as `laneSelection`, or `{ except }`, which Hide
lane writes when no `only` is in force. An `except` lane stays in the fetch, so
a hide refetches nothing and a lane no config or header names still draws when a
later window places it. `laneUniverse` is the adapter header's declared
`lanes`, then the track config's `assemblyNames`, then anything the window
placed that neither named. The header is read only when the adapter tiers or
declares `adapterCapabilities: ['headerLanes']` (`adapterDeclaresLanes`;
`installLodTierInfoFetch` in `MW/afterAttach.ts`).

**Frames.** `decideLaneFrames` (`MW/laneDecision.ts`) walks the lanes top down
once per settled block set: contig by `preferIncumbent` with a 1.5× switch
margin (`JC/plugins/linear-comparative-view/src/syntenyHysteresis.ts`), extent
by `keepNearMedian` (`OUTLIER_REACH = 1.5` window spans), rung off
`SCALE_LADDER = [1, 1.5, 2, 3, 5, 8, 12, 20, 40, 80]` with a 10% tolerance
(`RUNG_TOLERANCE`) and an 0.85 shrink room floored at 1 (`pickRung`),
orientation by a vote over ≥5 shared groups against the lane *above*, with a
0.9 deadband against an incumbent and the anchor-order sign for a fresh lane
sharing fewer (`orientationVote`, `decideOrientation`), offset by the weighted-median
displacement to the lane above, unclamped, so part of the fit can fall past an
edge and a frame can start below zero (`alignFrameTo`) — both read against the
anchor instead where the lane above shares fewer than three groups, which on a
pairwise star is every lane below the first — and a placement hold while the
frame still shows 90% of the placed weight a fresh alignment would
(`HOLD_COVERAGE`). Two reader pins from the lane header menu outrank the vote:
a contig pin (`pinnedLaneContigs`) while the window places anything on that
contig, and a flip pin (`pinnedLaneFlips`, against the anchor's
order) while the lane draws the contig it was set on. A lapsed or released pin
leaves no incumbent, so the lane decides fresh. Flip pins are held per anchor
(`laneFlipPinsByAnchor`), so another anchor reads none of them and a return to
the first, by Undo or by re-anchoring back, finds them again. The decision is
`{refName, flipped, rung, pivotAnchor, pivotLaneBp, fitMin, fitMax, alsoOn, alsoOnMore, pinned, orientationPinned}`
and the drawn frame is derived from it against the live view on every pan
(`frameFromDecision`; the model's `rowFrames`). A mate lane draws its frame plus
half a span either side (`frameReach`), the margin a pan translates into view
before the lanes re-lay out, while its placements stay filtered at the frame
edge (`groupRunsOnRow`). This machinery is
measured (§6.2) and is the
best-engineered part of the display; nothing here recommends touching it.

**Transitions.** A settle that re-decides a lane onto the contig it already
draws moves the lane over `MORPH_DURATION_MS` rather than snapping it
(`laneTransitionsAfter`, `MW/laneMotion.ts`). Both frames are affine in the
lane's bp, so the move is a per-lane map in the render state (`laneMaps`), which
the ribbons take through their per-edge scale and pan and the glyphs through
their block's range and `reversed`; a frame of the move uploads nothing. While a
lane moves, its frame carries the frames it moves from (`RowFrame.morphFrom`)
and the lane culls to all of them, so the first frame is the old picture; the
lane repacks once more when the move lands. A contig change, a first decision,
a jump whose two pictures share nothing on screen, a start more than 4×
magnified, a move under half a pixel, and `animationAllowed` saying no all
snap. A moving lane's header, and its strand rows under `splitStrands`, name the
frame the lane is drawn nearer to and turn over at the midpoint
(`lanesPastHalfway`), where a flip is edge-on. The model publishes `animating` for the capture waits, and a deadline in
`MW/afterAttach.ts` ends every transition at its end time whatever the
chrome's frame clock (`useAnimationFrames`) did.

**Lane genes.** `laneGeneTracks` walks every session track (connections
included) and keeps, per lane, the track the `laneGeneTracks` slot names for
its genome, else the best-ranked single-assembly annotation track by adapter
type (`MW/laneAnnotation.ts`); a hub holding 17 GFF3 gene sets for hg38 ties
on rank, which is what the slot is for. One `CoreGetFeatures` per lane over
`laneFetchRegion(frame)` — the window the frame can slide in plus its reach,
snapped to a power-of-two grid off the rung span — issued concurrently with
per-lane staleness so a pan re-asks only the lanes whose grid cell moved
(`installLaneFetch` in `MW/afterAttach.ts`). A lane gets one when the session
holds its assembly (`laneGenesFetchSpecs`).

**Lanes the session lacks.** A hub star's mates live in other hubs' configs.
The display puts its drawn, unheld lanes to `Core-describeAssemblies` in one
batch, each lane once (`lanesToDescribe`), and never calls
`assemblyManager.get` for them: that fires `Core-handleUnrecognizedAssembly`
per lane, and the Hubs plugin answers it by connecting each genome's whole
config. A description is the genome's assembly config and its gene adapter.
The display holds the assembly as a temporary one while it draws the lane
(`installLaneAssemblies`), so from then on the lane is held: its display name
labels it, and every fetch renames through it like any assembly's, with
`loadRefNameMap`'s `CoreGetRefNames` priming the adapter with the genome's
sequence and building the name map from the file's own names through its
aliases. **Nothing hands an adapter its sequence**: the display passes none
through any RPC, and renaming keeps none a caller passes. The gene adapter
stands in for a session track. Per-lane gene adapters written into the star
config were declined for this point, which also serves stars no builder wrote.

The display gives its temporary assemblies back when it goes, through the
session it captured at attach, since a display is destroyed after its view
has been detached. Another display still drawing that genome holds it again.
"Open in new view" gives one back first, so the new view finds the genome
unrecognized and its hub connects it as a session assembly with its tracks. A
restored session brings the temporary assemblies back without their gene
adapters, so a lane held only temporarily is described again.

An answer still out holds readiness as an outstanding lane fetch does, until
it lands or `DESCRIBE_DEADLINE_MS` passes; a later answer still labels the
lane. A reload asks again about lanes that got no description.

Every demo star holds all its lanes, so nothing there reaches the point; hub
stars and a lane picked past a GBZ's held haplotypes do. The Hubs plugin
(jbrowse-plugin-hubs `describeAssemblies.ts`) answers from each genome's
hosted config, `minimal.json` for a UCSC db and `config.json` for GenArk, with
no connection: the assembly as that config writes it, `baseUri` stamped beside
each `uri`, since jb2hubs writes `chromSizes` and the alias file relative to
the config, and the gene track jb2hubs' `defaultGeneTrackId` picks. On hg38's
UCSC mates that track spells chromosomes as the liftOver chains do (`chr1`); a
GenArk-backed db such as rn8 picks the GenArk `.bb`, spelled `NC_…`, which
draws only through the aliases.

**Lane layers.** `laneLayers` declares rows of data every lane draws between
its header and its genes, each on one value scale shared by every lane
(`laneLayerDomains`, clipped at the 99th percentile each side). A lane reads a
layer from the `tracks` entry on its genome, else from the layer's `adapter`,
a template of a type declaring `READS_REFERENCE` that the adapter cache
keys per genome's sequence. A template reads a lane only while each region it
asks for is under `LANE_TEMPLATE_MAX_BP`, since that region is the sequence it
downloads; past it the band's title says to zoom in. An adapter type that
computes from no sequence is no template, because every lane would read the
one file at its own coordinates.

**Lane links.** For a source whose features carry no `name` and whose header
names no `anchorAssemblyName`, one `CoreGetFeatures` per *adjacent* lane pair
the session holds both assemblies of, on the upper lane's window with
`targetAssemblyName: lower` (`laneLinksFetchSpecs`). The display asks an
adapter declaring `adapterCapabilities: ['lanePairsOnAnchor']`
(`adapterPairsOnAnchor`) for every adjacent pair, star or not, on the anchor's
merged blocks with `queryAssemblyName: upper` and `targetAssemblyName: lower`,
since such an adapter cuts a pangenome graph on its reference alone and every
lane's walk passes through that window. The adapter answers with the alignment
the graph records between the two walks, the nodes they share, and runs no
aligner; the display draws those records' `alignmentOps` in the gutter as it
draws any direct pair's.
`pairLinks` composes a pair's links through the anchor
(`MW/composeLaneLinks.ts`) wherever a star holds no direct records for the pair
(not asked, not landed yet, or answered empty), for any pair whose fetch came
back empty or failed, and for a pair the session lacks an assembly of; a
non-star pair whose fetch has not landed draws nothing yet. `composeLaneLinks`
steps two records that carry ops through each other (`composeAlignmentOps`) and
interpolates any other between its clipped ends (`projectOntoLane`), so the
display draws nothing in the gutter for sequence two lanes share and the anchor
lacks.

What composition through GRCh38 loses, per adjacent pair on the hosted HPRC
v2.1 graph (2026-09-26), is the third C4 module, the GSTT1 branch, the KIR
B-haplotype genes and the DR52 region, the sequence those loci were picked
for. A pair that includes a GRCh38-like haplotype loses under 0.3 kb, and
the CFH deletion and the FLNA inversion lose nothing, since there the shared
sequence is GRCh38's own. That loss is why a graph adapter's lane pair is the
alignment `pairAlignments` reads off the graph rather than a composition.

<!-- BEGIN GENERATED MEASUREMENT multiway-composition-through-grch38 -->

_Generated by `pnpm autogen` — edit the source, not this block._

| locus    | pair                 | shared on graph nodes | drawable through GRCh38 |   lost |
| -------- | -------------------- | --------------------: | ----------------------: | -----: |
| C4       | HG01978#2, HG02004#2 |               182,945 |                 150,178 | 32,767 |
| GSTT1    | HG00097#1, HG00146#1 |               145,014 |                  90,478 | 54,536 |
| KIR      | HG00133#1, NA20503#1 |               231,857 |                 157,566 | 74,291 |
| HLA-DR   | NA19036#2, NA18906#1 |               186,684 |                 164,037 | 22,647 |
| CFH      | HG01109#1, HG01123#1 |               115,337 |                 115,013 |    324 |
| FLNA/EMD | HG01150#2, HG00735#1 |                99,977 |                  99,934 |     43 |
| amylase  | NA18608#2, HG00232#1 |               213,977 |                 213,918 |     59 |

<!-- END GENERATED MEASUREMENT multiway-composition-through-grch38 -->

The reader's chained shared runs (`sharedRuns` plus `chainRuns` in gbz-base's
`pairAlignment.ts`, no bases compared) come within 0.3% of the set count
wherever a node is visited once. The tandem array is the limit: at amylase the
chain anchors 148 kb of the 214 kb two walks share, the extra copies fold onto
nodes GRCh38 visits once, and counted by visits the pair loses 64,352 bp.

**Rendering.** Cells keyed by identity: `bands`, `ribbons:<row>` per gutter plus
`ribbons:<row>><toRow>` per bridge, `ticks:<row>`, `glyphs:<row>` and
`boxes:<row>` per lane (the key functions and builders in
`MW/multiwayGeometry.ts`; the model's `namedCells` and `namedLayers`). Ribbons
ride the pairwise synteny marks and lanes the feature track's glyph marks, one
mark list (`MULTIWAY_MARKS`, `MW/multiwayMarks.ts`) that `MW/MultiWayRenderer.ts`
hands to `createMarkBackend`; Canvas2D and SVG walk the same cells. A pan is one
translate (`dragOffsetPx`); the DOM is 22 nodes at 7 lanes (design record §"The
backend landed 2026-08-27").

**LOD.** `lodTier` resolves on the main thread off the settled zoom and the
track's `coarseBpPerPxThreshold` (`lodTierAt`,
`JC/packages/synteny-core/src/lodTier.ts`) and is folded into `viewSignature`.
A gutter that is a direct pair reads its record's ops, but the tier changes no
extent, so for this display it is close to a byte knob: coarse rows have the
same extents with folded CIGARs, and the detail a gutter draws degrades with
them rather than disappearing.

### 1.2 What an adapter must provide

The display asks for: (a) anchor-with-no-target records, each clipped to the
window on both axes (`JC/plugins/comparative-adapters/src/clipFeatureToRegion.ts`;
CIGAR-exact clip when the record carries one, proportional otherwise, `:40-80`),
cut at every indel of `SPLIT_AT_GAP_BP` or more into one feature per gap-free
run, with the CIGAR dropped after the clip. A nameless record's group key is
its id, so a source answering per window has to mint the same id for the same
run on every refetch, or the clicked outline and the hover re-resolve to
another group; `clipToRegion`'s region suffix is the pattern; (b) optionally, direct records for a mate
pair, asked on the upper lane's window or, with `lanePairsOnAnchor`, on the
anchor's; (c) a `CoreGetInfo` header with `hasCoarseTier`, optionally
`anchorAssemblyName` and `lanes[{name,label,group}]` (`starAnchorOf`,
`declaredLanesOf`).
Today's providers:

- `MCScanBlocksAdapter`: reads the whole table and every BED up front, answers
  any column pair, and is the only adapter implementing `mateShape: 'grouped'`
  (`JC/plugins/comparative-adapters/src/MCScanBlocksAdapter/MCScanBlocksAdapter.ts`, the `grouped` branch of `getFeatures`).
- `MultiPairwiseSyntenyAdapter`: N pairwise PIF children, each subscribed at
  once and emitted in child order (`getFeatures`, ids re-keyed
  `${childIndex}-…`); header folds the children's tiers (`hasCoarseTier` only
  when every child has one, [SYNTENY_LOD.md](SYNTENY_LOD.md)`:135-143`), names
  the anchor, and declares every mate as a lane, labelled and grouped by its
  `lanes` slot. It declares `headerLanes`, so a window reads only the children
  for the lanes the display asks for (`childrenForLanes`), and a star over every
  liftOver file a genome has costs the chosen lanes' reads. The header's tier
  facts and the anchor's refNames narrow the same way, each child's answer
  being its index: the header read names the display's lanes, the fetch
  carries them beside its regions so the rename pass loads a map per selection
  (`refNameMapKey`), and the track warm-up sends a lane-declaring source no
  refNames call at all. `mateShape:
  'grouped'` is ignored by every PIF adapter: each record
  arrives as one feature with one `mate`, and the display groups on the clipped
  `syntenyId` (file offset plus window). A mate-vs-mate query returns the empty
  answer, not an error (`:78-98`). A PIF is a bgzipped PAF written twice, once
  per side, pre-oriented and tabix-indexed under `q`/`t` (fine) and `Q`/`T`
  (coarse) prefixes (`JC/plugins/comparative-adapters/src/util.ts:580-660`).
- `MultiGenomePAFAdapter` and `MultiGenomeIndexedPAFAdapter`: one PanSN file,
  star or all-vs-all. The in-memory adapter raises `noSuchPairError` for a pair
  the file states no alignment for, which the lane-links fetch logs and stamps
  empty; the indexed one cannot tell an unstated pair from an empty window
  without a scan, and answers empty.
- `GbzBaseSyntenyAdapter` (`P/src/GbzBaseSyntenyAdapter/GbzBaseSyntenyAdapter.ts`):
  anchor-only (it emits nothing for a lane-assembly region). With
  `queryAssemblyName` it answers `lanePairsOnAnchor` from the graph's own
  alignment of the two lanes' walks, the nodes they share, on the upper lane's
  contigs; it runs no aligner, and the display composes a pair it answers
  nothing for. gbz-base keeps its aligner, `Subgraph.pairAlignments`, in its CLI
  (`--against`, `--stack`), where a host runs it offline and serves the result
  as a file. Its reference records: one per haplotype contig after the sibling
  join (`G/src/subgraph.ts:255-300`), header `lanes` = every haplotype in the
  graph minus the reference (`getHeader`; 464 on HPRC v2.1),
  `hasCoarseTier: false`, no `identity`, and the lane selection handed to
  gbz-base as `keep`, which walks only those haplotypes where the companion has
  anchor rows (`keepPredicate`).
  Measured at context 1000 with both files hosted: C4 60 kb 5.0 s, CFH 8.1 s,
  KIV-2 130 kb 8.5 s, MHC class II 12.7 s, AMY1 12.8 s
  (`P/agent-docs/GBZ_HANDOFF.md:157-168`).

### 1.3 Where the "one gene row per lane" simplification lives, and what it forecloses

A lane is `Lane` in `MW/laneStack.ts`: an assembly name, a frame, a
`hasAnnotation` flag, the group placements in px, and two functions. The session
does not know lanes exist. Concretely:

- One annotation per lane, named by the `laneGeneTracks` slot or else chosen
  by rank (`laneGeneTracks`). A lane cannot show a second track, a wiggle, variants,
  reads, or sequence, and the gene track it shows is not the track the user
  configured a display for; it is the raw adapter re-drawn through
  `geneGlyph.ts` with the canvas track's rules (design record §"Gene glyph
  rendering"). ADR-180 makes a lane a list of grammar layers drawn through its
  frame, which is how a second row arrives: gene names are the first extra
  layer, on by default (`showGeneLabels`, placed by `laneGeneLabels`), and add
  a 12 px row to each lane's band.
- No per-lane navigation or zoom, by design: the lanes re-fit to the anchor's
  viewport, and the launch below is the route to a lane you drive yourself.
- One contig per lane (`pickContig`, `MW/laneDecision.ts`); a second copy
  is named in the header and reachable by pin, never drawn beside the first
  (design record §"Multi-copy lanes").
- Self-comparison lanes are dropped (`rowAssemblies` removes mates whose
  assembly is the anchor's).
- The SVG export is the viewport at the current `scrollTop`, so a 44-lane figure
  is a screenshot of a scrolled canvas, not the stack.
- Height is divided until `MIN_LANE_PITCH = 22` px plus the 12 px gene-name
  row, 34 px with names on, then fixed and scrolled (`laneContentHeight`); at
  the floor the glyph row is 5 px (`laneGeometry`), one strand row, which is
  the E. coli figure's gene height. A lane splits its strands only with room
  for two rows of 5 px.

The escape hatches are two: **Open ⟨assembly⟩ at the matching region**
(`openInNewView`), which opens an *unsynchronised* LGV with the multiway track
and the gene track the lane draws, and **Launch → Linear synteny view (visible
region)** (the model's `trackMenuItems`), the stacked view §2.3 costs out.

## 2. The two named tutorials

### 2.1 `ecoli_orthologs_synteny` (44 E. coli and Shigella under K-12)

**Data.** `JC/website/docs/tutorials/ecoli_orthologs_synteny.md`: a gene-symbol
join over RefSeq GFF3s (`symbols_to_blocks.py`) written as an MCScan `.blocks`
table with 44 columns; hosted at `jbrowse.org/demos/ecoli_orthologs/`. Measured
on 2026-09-30: 44 assemblies (each a `ChromSizesAdapter`), 45 tracks,
`ecoli.blocks.gz` 60 KB, blocks plus 44 BEDs 2.3 MB total, display
`height: 1500` (44 × 34 px, the floor with gene names; `MW/laneStack.test.ts`
pins that every checked-in demo sizes its track to the whole stack). Every lane's genes come
from its own tabix GFF3.

**What the display does well here.** This is the case the display was built
for. Group keys are gene symbols, so one anchor gene chains through every lane
and `bridgeSkippedLanes` (`buildRibbonGeometry`) carries a group past
a lane that lacks it; the lane-genes fetch gives every lane real exon structure;
colour by ortholog group (`{ field: 'cluster' }`) makes a
conserved gene one colour down the stack; the O-antigen figure is an honest
negative (the flanks, the _rfb_ genes and PGAP's _wzx_/_wzy_ chain where a strain
carries them, and the serotype-specific genes between draw grey, since a K-12
window draws only rows holding a K-12 gene). The adapter loads 2.3 MB once and
answers every window from memory.

**What it does badly here.**

- *Readability at 44.* 5 px glyphs, 12 px labels, 22 px pitch. The figure is
  legible as a barcode, not as gene models. Past ~500 kb "the stack is
  unreadable and no figure should try: the display has no coarse tier, and at
  44 lanes the bridged ribbons of any sparse lane sweep the whole track"
  ([DEMO_DATASETS.md](DEMO_DATASETS.md)).
- *Order is density, not phylogeny.* Densest-first (`rowAssembliesOf`) puts the
  K-12 derivatives on top at the O-antigen locus only because they share the
  most symbols; the reader is told "the reduced Shigella genomes fall toward the
  bottom without anything naming them". A 44-way stack wants a tree order; the
  seriation design is written but not built
  ([../ideas/waiting-on-a-call/ordering-synteny-lanes-by-similarity.md](../ideas/waiting-on-a-call/ordering-synteny-lanes-by-similarity.md)).
- *44 lane-gene RPCs per settle* (one tabix query per lane; the per-lane
  staleness gate reduces a pan to the lanes whose grid cell moved). Fine at 44, and the reason
  the cost is linear in lanes.
- *No hiding of empty lanes automatically* (Hide lane is manual).

**A user who wants more than one row per genome.** Nothing in-display. The
options are: open a lane in its own LGV (unsynchronised; the multiway track
rides along so the new view is the same stack re-anchored, but the two views do
not follow each other), or launch a `LinearSyntenyView`. For a blocks table the
launched stack works: the adapter answers any column pair, so every level
between adjacent rows draws (`columnPairs`, `MCScanBlocksAdapter.ts:415-440`).
The costs are in §2.3.

### 2.2 `hg38_vertebrates_synteny` (hg38 and eight UCSC genomes)

**Data.** `JC/website/docs/tutorials/hg38_vertebrates_synteny.md`: a
`MultiPairwiseSyntenyAdapter` over eight UCSC liftOver chains converted to
indexed PAF (`hg38To<Genome>.over.pif.gz`, 26-173 MB each, measured on
2026-09-12 via `Content-Length`), hub assemblies and `ncbiRefSeq` tracks lifted
from each genome's hub config. All eight PIFs carry a coarse tier and a
version-2 `#pif` header since their 2026-09-11 rebuild
([DEMO_DATASETS.md](DEMO_DATASETS.md), `demos/hg38_vertebrates`), so the star
offers **Level of detail**. The checked-in config's display height is 310
(nine rows at the 34 px floor with gene names is 306), while the tutorial
session overrides it to 600.

**What the picture actually contains.** The records the display fetches for the
TP53 window (`tabix … tchr17:7400000-7700000`, the hg38 side of each PIF) place
the window with *one whole-chain record* per lane:

| PIF | records overlapping 300 kb | the chain record | CIGAR ops | CIGAR bytes | in-window I / D bp | largest in-window gap |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| hg38ToMm39 | 8 | chr17:1.34-15.72 Mb ↔ mm39 chr11, `-` | 300,251 | 778,634 | 145,673 / 167,860 | 25,367 |
| hg38ToCanFam6 | 2 | chr17:4.00-15.72 Mb ↔ chr5 | 275,447 | 719,146 | 93,987 / 144,020 | 31,736 |
| hg38ToBosTau9 | 3 | chr17:1.34-15.72 Mb ↔ chr19 | 280,390 | 734,277 | 160,036 / 141,473 | 89,487 |
| hg38ToPanTro6 | 1 | chr17:0.49-21.62 Mb ↔ chr17 | 34,169 | 104,290 | 3,604 / 4,432 | 2,202 |

Before the gap split landed (§4.1), the display clipped that record to the
window (CIGAR-exact at the two edges, `clipFeatureToRegion.ts`), drew it as one
parallelogram and composed the mate-to-mate links between adjacent lanes by
linear interpolation (`projectOntoLane`). The tutorial's caption for
the figure read "Every lane places the window as one straight block", and the
text said "this is a neighbourhood conserved across the mammals, and the picture
says so by having nothing to point at". Inside that same window the mouse chain
carries 146 kb of insertion and 168 kb of deletion in 3,450 gaps, the largest
25 kb; the cow chain has an 89 kb gap at chr17:7,515,121. The straightness was
the display's blindness to the CIGAR, not conservation. At 189 bp/px (300 kb
over 1588 px) the interpolation error at a composed mouse-to-dog link could
reach 130 px, and a cow ribbon endpoint could be 470 px from where the alignment
puts it. The `identity` colour mode cannot rescue that: a composed link carries
no `identity` and keeps the slot colour (`ribbonColorer`).

The second figure (17p near PMP22) is honest for a different reason: there the
chains *break*, breaks are separate records, and separate records the display
does draw.

**Fetch cost of "fine at every zoom".** A 300 kb window pulls the whole chain
row per lane: 0.7-0.78 MB of CIGAR text for mouse, dog and cow, parsed and
walked in the worker for every static-block change, to produce one clipped
extent. Until the 2026-09-11 rebuild five headerless PIFs pinned the star to
fine ([SYNTENY_LOD.md](SYNTENY_LOD.md)`:135-143`), and the display cannot ask for
coarse on its own behalf even though it keeps the CIGAR only where a gutter
draws from it. The tutorial's
statement that the **Level of detail** entry "is offered once every child
carries a coarse tier" (`hg38_vertebrates_synteny.md`, "The composed track") was
not what the code did on the reading date: the menu was gated on the *threshold
slot*, which `MultiPairwiseSyntenyAdapter` declares unconditionally
(`trackHasLodTiers`, `lodTier.ts:225-229`;
`MultiPairwiseSyntenyAdapter/configSchema.ts:63`), so on this demo the menu
showed and never switched anything. The header gate has since landed — see the
block at the top of this file. What a coarse tier is worth is measured: 1.31 MB
against 64.23 MB on a whole-genome pass over a 130 MB PIF, 49× fewer bytes
(`../measurements/pif-tier-wire-bytes.json`).

**Ribbons.** Only the anchor→first-mate gutter comes from group placements; from
the second gutter down the ribbons are composed links
(`buildRibbonGeometry`, `row > 0`). With one record per lane that is
one parallelogram per gutter. The gene glyphs are the real content of this
picture, and they are correct: they are drawn at each genome's own coordinates
from its own track.

**A user who wants more than one row per genome, from this track.** **Launch →
Linear synteny view (visible region)** seeds a dialog from the multiway track
(the model's `trackMenuItems`; `syntenyRegionMenuItems` in `JC/plugins/linear-comparative-view/src/LaunchSyntenyView/regionLaunchMenuItems.ts`),
resolves one panel per mate, and builds a `LinearSyntenyView`. On the reading
date it put the anchor at index 0 by default and **the same track on every
level** (`LaunchSyntenyView/buildSyntenyViewSpec.ts:53-104`,
`tracks: panels.map(() => [trackId])`). For a star that meant level 0 (anchor vs
first mate) drew and every other level asked `MultiPairwiseSyntenyAdapter` for
mate-vs-mate, which returns nothing by design
(`MultiPairwiseSyntenyAdapter.ts:78-98`; a `MultiGenomePAFAdapter` star raises
`noSuchPairError` instead). Dragging the anchor to the middle of the
dialog's list got two drawing levels of eight
(the comment above `toPanelRows` in `LaunchSyntenyView/panelOrder.ts` says so). The stacked
view has no notion of "every level anchored on the hub"; a level is
`views[i]`/`views[i+1]` in ten files (design record §"A ribbon bridges a lane
that places nothing for its group"). So the honest answer for a star was: eight
rows, one or two bands. The **Repeat ⟨anchor⟩ between panels** landing (§4.4) is
what made every band a direct pair, at 2N-1 rows.

Two more things about that route are worth knowing. The rows came from the
`SyntenyDiscoverMates` RPC over the dataset
(`makeMateDiscovery` in `LaunchSyntenyView/discoverMates.ts`), not from the display's lane
selection or `domain` — the launch forgot what the reader chose, and on a GBZ
track it was a second full-cohort window fetch that proposed every haplotype the
window places as a panel; `lanePanelsForRegion` replaced it (§4.4). And each
level instantiates its own copy of the synteny track, display and canvas
backend, with heights budgeted as `max(40, min(100, 320 / levels))`
(`JC/plugins/linear-comparative-view/src/LinearSyntenyView/levelHeightBudget.ts:12-23`),
so an eight-mate launch is eight 40 px bands.

### 2.3 The two routes, costed

| | MultiWay lanes (one track) | LinearSyntenyView (one LGV per row) |
| --- | --- | --- |
| **Control** | Order by drag/menu, hide, pick, pin contig, flip, re-anchor; no per-lane zoom, no extra tracks, no per-lane locstring | Full LGV per row: any tracks, independent navigation, rubberband, feature detail; order by moving views; no densest-first, no bridging, no lane picker |
| **State** | the `domain` slot, and `laneFilter` and `lodMode`, on one display; features volatile | N `LinearGenomeView` models plus N-1 `LinearSyntenyLevel` models, each level holding its own full track model, display and rendering backend (`LinearSyntenyView`'s `levels` and `reconcileLevels`; `LinearSyntenyViewHelper`); every row's tracks persist |
| **Fetches** | 1 star fetch (+ N children inside the adapter) + N lane-gene RPCs + (N-1) link RPCs for nameless non-star sources and `lanePairsOnAnchor` adapters | N-1 synteny fetches (one per level, each its own display) + each row's own track fetches; each level refetches independently on its own pair of viewports |
| **Performance** | One canvas, ~10 GPU draw calls per lane (§3), 22 px per lane floor | N LGV React trees and rulers, a synteny canvas per level; rows are ≥ ruler height each, so 8 rows fill a screen and 44 do not fit |
| **Correctness** | Lane frames are affine fits (§4.1); composed links interpolate; ordering by the heaviest contig's weight (§4.3) | CIGAR-exact ribbons and per-base detail on each level; but for a star only levels touching the anchor draw, and a level with an unstated pair is either blank (MultiPairwise) or an error (MultiGenome) |
| **Scale** | linear in N, readable to ~50 with scrolling | usable to ~5 rows; the design record calls a cohort "a multiple alignment rather than a stack of pairwise bands" (`comparative-adapters/src/util.ts:255-263`) |

The "harder to control" the maintainer names is real and has a specific shape:
a stacked view is N independent navigators tied by adjacent-pair bands, so the
one thing the lane stack does for free — keeping every genome pinned to the
anchor's viewport — is the thing the stack cannot do, and for a star source the
bands were missing where a reader expects them until the anchor repeat landed.

## 3. Speed and scalability

### 3.1 Fetch counts per settle

N = mate lanes drawn (after selection).

| cost | 8 | 64 | 464 | 4,000 | where |
| --- | ---: | ---: | ---: | ---: | --- |
| ortholog fetch (RPCs) | 1 | 1 | 1 | 1 | `fetchPhases` |
| …inside a `MultiPairwise` star: child tabix reads | 8 | 64 | 464 | 4,000 | `childrenForLanes` and the subscribe loop in `MultiPairwiseSyntenyAdapter.ts` |
| …inside a PanSN PIF: records parsed | ≈lanes × records/lane | | | | one index read |
| …inside GBZ: walks extracted, identified, aligned | every haplotype in the window (465 at KIV-2) regardless of N | same | same | same | `P/…/GbzBaseSyntenyAdapter.ts` (`keep`); `P/agent-docs/HAPLOTYPE_WALKS_REVIEW.md:36-39` |
| lane-gene RPCs (lanes the session holds) | 9 | 65 | 465 | 4,001 | `laneGenesFetchSpecs` |
| lane-link RPCs (nameless non-star, or `lanePairsOnAnchor`) | 7 | 63 | 463 | 3,999 | `laneLinksFetchSpecs` |
| header read | 1 | 1 | 1 | 1 | `installLodTierInfoFetch` |

The star fan-out is hidden inside one RPC but is still N HTTP range reads per
window; `MultiPairwiseSyntenyAdapter` issues them concurrently. The lane-gene
and lane-link fetches are concurrent with per-lane staleness, so a pan that moves
one lane's grid cell costs one RPC, not N (design record §"Genome scale over an
alignment-level source") — that is the one place where the display is
sub-linear.

### 3.2 Main-thread work per settle

- `groupFeatures`: O(records). `rowAssembliesOf`: O(groups × mates).
- `laneGeneAdapters`: O(sessionTracks + lanes) since 2026-09-12, one canonical
  name per track and per lane joined in a map, recomputed whenever
  `rowAssemblies` changes. It was O(sessionTracks × lanes) `isSameAssemblyName`
  calls, 232,000 alias resolutions for a 500-track hub session at 464 lanes;
  neither cost was measured.
- `decideLaneFrames`: per lane, `fitLane` scans every group and
  `orientationVote` sorts the shared set: O(N × G log G). Measured at 7 lanes
  and 660 groups: 12.7 ms of MobX per zoom step packing the cells (§6.5); glyph cells 34 ms at 5,009 on-canvas genes
  (`JC/plugins/linear-comparative-view/benches/multiwayZoomCost.probe.ts:19-25`).
  Linear extrapolation to 464 lanes at the same group count is ~0.8 s per
  settle, before rendering.
- `pairLinks` composes every adjacent pair from scratch on every fetch commit:
  O(N × records).

### 3.3 Rendering

`renderLayers` is `bands + (N gutters + bridges) + N tick layers + 2N glyph
layers`, and the mark backend `MW/MultiWayRenderer.ts` builds over
`MULTIWAY_MARKS` (`MW/multiwayMarks.ts`) draws one block per layer, a draw per
mark. A glyph layer runs the feature track's line, chevron, rect and arrow
marks (`featureGlyphMarks`,
`JC/plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphMarks.ts`), so
the frame cost is roughly 10 draw calls per lane whatever is on screen: ~80 at
8 lanes, ~4,600 at 464, ~40,000 at 4,000. Nothing culls layers that are scrolled
out of the viewport. The pick does not draw at all: `pickRibbonAt` walks
`ribbonRegions` — the gutters' ribbon geometry in draw order — through the same
`createSyntenyPicker` the pairwise display uses, so it stabs a 1D flatbush index
of x-hulls and tests what comes back exactly ([SYNTENY_PICKING.md](SYNTENY_PICKING.md)).

**A gutter stacks its ribbons' alpha, as the pairwise band does**, so a pixel
several ribbons cover reads darker. 1e1b761b2b painted the strongest ribbon over
a pixel instead, under a `min` blend: that cleared the starbursts an inversion's
~150 one-pixel tiles draw at hg38 chr17:15.2–16.4 Mb, but it flattened the
overlap shading and drew the first gutter's ribbons short, so we removed it.
`buildBandCell` lays paper under every gutter, the anchor's half of the first
one included, and its stripes shade lane bodies only.

### 3.4 Pixels

`laneContentHeight = max(height, rows × 22)`: 464 lanes
is a 10,208 px scrolling stack with 5 px gene rows; 4,000 lanes is 88,000 px. A
scrolled stack is still fully laid out and fully drawn.

### 3.5 Session and config

The display persists four small properties. The real state cost of a cohort is
upstream: a lane draws genes only if the session holds an assembly for it
(`holdsAssembly`) or a plugin describes it, so a 464-lane HPRC config with no
describing plugin needs 464 assemblies (GenArk
2bit + chromAlias each, [PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md) "Any donor
can be loaded as an assembly") and 464 annotation tracks (the eight CAT GFF3s in
`demos/hprc_multiway` are 114-127 MB bgzipped each,
[DEMO_DATASETS.md](DEMO_DATASETS.md)`:339-345`). The PIF product is linear too:
eight haplotypes at 16 MB each (`P/agent-docs/HAPLOTYPE_WALKS_VISION.md:37-38`),
so 464 is ~7.4 GB and 4,000 is ~64 GB of hosted PIF, and the review puts any
per-haplotype store at 6-8 GB per product at 464 and 50-70 GB at 4,000
(`HAPLOTYPE_WALKS_VISION.md:23-32`).

### 3.6 The picker

`LaneSelectionDialog` (`MW/components/LaneSelectionDialog.tsx`) is a flat list
of `LabeledCheckbox` rows grouped by sample with a substring filter; every tick
rebuilds a `Set` and re-renders every row. It is fine at 464 and is a wall at
4,000 (4,000 MUI checkboxes per keystroke). It offers no "which haplotypes
differ here", which is the only question a reader has at that scale.

### 3.7 What breaks first, by source

- **Gene table (E. coli, primates):** the lane-gene fan-out and the glyph cell
  rebuild; pixels at ~50 lanes. Nothing else.
- **PIF star (vertebrates, HPRC eight):** fetch bytes at the fine tier
  (0.7 MB of CIGAR per lane per window at TP53) until the five PIFs are rebuilt;
  then pixels and draw calls at a few hundred lanes.
- **GBZ:** the fetch. 5-56 s per window for every haplotype (the Paths scan of
  53,150 paths is once per database, `GBZ_PLAN.md:147`), `nodeLimit` refusing
  wide windows, and no coarse tier. Lane selection saves the display's per-lane
  work and nothing on the query (`GBZ_PLAN.md:297-301`).

## 4. Correctness: what the 2026-09-06 reading found

The findings below are the reading as it was taken. The block at the top of this
file says which have landed since, and the ones still open are in
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md).

### 4.1 Alignment sources were drawn as affine blocks — fixed

Verified in §2.2 with the TP53 records. The chain of causes: `clipToRegion`
clips a record to the window on both axes exactly (`clipFeatureToRegion.ts:56-80`
walks the ops) and then drops the alignment string; the display drew the clipped
extent as one placement (`groupRunsOnRow`); `composeLaneLinks.projectOntoLane`
maps an anchor sub-interval into a lane by the record's overall ratio. The tests
pinned the
interpolation as specified (`MW/composeLaneLinks.test.ts`) and nothing measured
either against a CIGAR oracle. The design record chose the affine placement
for rendering reasons (per-base lanes came later, §6.1); the consequence that
*placements* — not per-base marks — were wrong by up to the largest interior
indel was stated nowhere, and the hg38 tutorial presented the artefact as
biology.
`SPLIT_AT_GAP_BP = 10_000` closed it.

### 4.2 Three documents, two strand semantics — fixed

`ribbonColorer` colours a ribbon by the product of the two runs' orientations
against the anchor — "the record's strand, as the synteny view means it — and
not the drawn twist: a lane whose every placement is inverted is drawn flipped,
so its ribbons run straight while every one of them is an inversion"
(`MW/multiwayGeometry.ts`, applied in `buildRibbonGeometry`). The config slot
said the opposite: "`strand` reads whether the ribbon is crossed — the lower
placement runs the other way from the upper one" (`MW/configSchema.ts`); the
design record said "Strand reads the DRAWN twist rather than a record's strand";
the tutorial said "paints a ribbon that crosses" (`hg38_vertebrates_synteny.md`,
"Color by... → Strand"). For any lane drawn `[rev]` the code and the two
prose statements disagreed on screen, and no test pinned the semantics for a
flipped lane. All three now state the record's strand.

### 4.3 "Densest first" rewarded fragmentation on an alignment source — fixed

`rowAssembliesOf` sorted by placement *count*.
For a named table that is "how many genes this lane shares". For a nameless
source every record is one group with one placement, so a haplotype whose
alignment *breaks* in the window had more placements than one that runs through.
At the CFH window the four CFHR3/CFHR1 deletion carriers are two records each
and the non-carriers one ([HPRC_RELEASE2.md](HPRC_RELEASE2.md), "Unpacking pairwise alignments from the graph"), so the
carriers sorted to the top by construction and the reader was told they were
"densest". The `weight` the contig vote already uses (anchor bp for nameless
records) is the right quantity and was sitting on every group; the sort weights
by it now.

Summed over every contig, it still rewarded a lane for scattering. At TNNT3
(hg38 chr11:1,822,680-2,024,156, the liftOver star) platypus scored 317k from
96 placements on ten contigs while the one contig its lane draws held four
groups, 15% of the window, and it sat 17th of 26 above baboon. A lane draws one
contig, so the sort now takes the heaviest contig's weight, the quantity
`pickContig` votes with.

### 4.4 The launched stack from a star — fixed

§2.2 records the route as it stood: `buildSyntenyViewSpec` put the same track on
every level and the anchor on top by default, so for a star every level but the
first was empty (`MultiPairwise`) or an error (`MultiGenomePAF`; GBZ
answers nothing for a lane region, `P/…/GbzBaseSyntenyAdapter.ts`). The
dialog's own comment knew a three-panel launch "wants the anchor in the middle"
(the comment above `toPanelRows` in `LaunchSyntenyView/panelOrder.ts`). The block at the top of this file
says what replaced it.

### 4.5 Lane-link tier on a mate lane — checked, not a defect

The pair fetch is issued at the *anchor's* tier over the upper lane's region
(`laneLinksFetchSpecs`), while that lane may be drawn at up to 80× the anchor's
bp/px (`SCALE_LADDER`). The ladder only zooms a lane out, so an anchor past the
coarse bound puts the lane past it too: the tier is never wrong output, and the
most it costs is fine bytes the lane could have skipped. No hosted source pays
that — the E. coli all-vs-all files carry no coarse tier, and the HPRC PIF's
only target is GRCh38, so its pair queries answer empty (`tabix -l`,
2026-09-13).

### 4.6 Coordinates, inversions and the reversed anchor — checked, correct

The reading looked for the classic errors and did not find them: mate
orientation is read from the pair, never the mate's transcription strand
(`MatePlacement`, pinned in `layoutMultiWay.test.ts`); an inversion is an
ordered span pair joined end to end so two lanes both reversed against the
anchor draw straight between themselves (`groupRunSpansOnRow`;
`RibbonBuilder.add`); a direct link reverses its lower span on `-` strand
against lanes that are themselves mirrored by `rowFrameX`, and the four
flipped/unflipped cases worked by hand compose correctly; the anchor axis clips
rather than tests (`axisPlacement`, three tests); a horizontally flipped view
mirrors every lane without re-deciding (`frameFromDecision`, pinned in
`laneDecision.test.ts`). Coordinates are chromosome-local numbers throughout,
no 2^32 issue.

### 4.10 The lane sort is exact, and its tie-break is file order

`rowAssembliesOf` sorts lanes by their heaviest contig's summed weight and
tie-breaks on `appearance`, the first-seen index over the anchor-sorted groups. The weights are integers —
one per gene, or anchor bp for an alignment — so the sort is exact and
independent of accumulation order: given the same feature list the lane order
is fully determined.

At the HPRC CFH window the tie-break decides everything. The four non-carrier
haplotypes tie at exactly 300,000 anchor bp and the four carriers at exactly
215,316, the 84,684 bp the CFHR3/CFHR1 deletion removes, so within each group
the stack is simply PIF file order. Both were measured when the sort summed
every contig; a haplotype placing the window on one contig scores the same
under either rule. `MultiGenomeIndexedPAFAdapter` sorts its concurrent reads by
`fileOffset` precisely so that order is reproducible, and a single-region fetch
is therefore deterministic.

The exposure was `ComparativeAdapterBase.getFeaturesInMultipleRegions`, which
`merge`d the per-region streams: on a multi-region view the arrival order varies
run to run, and against ties this size that is enough to swap two lanes. It now
applies the file-order discipline the indexed PAF adapter already had — each
region still subscribes at once and only the emission waits for its turn.

The inverted lane order between the `pangenome/hprc_cfh_haplotypes` and
`multiway_synteny/hprc_lane_menu` figures was **not** that bug. The hosted PIF
was rebuilt from HPRC release 2.1 on 2026-09-06, between the two captures;
`hprc_lane_menu` was shot on 2026-09-05, so the two pictures were of two
different datasets. The 2026-09-09 reshoot settled it, and the two now agree
haplotype for haplotype. `multiway_synteny/hg38_vertebrates_17p_break` was stale
the same way against `05ec50660e` — it drew the marmoset lane `[rev]` at
`2.4Mbp 2x` where the code decides forward at rung 3 — and the same reshoot
fixed it.

The whole-chromosome figure is `multiway_synteny/hprc_chr12_whole` because chr1
drew lanes that looked like haplotypes missing 1q. HG00099, HG00128 and HG01109
assembled chr1 as two scaffolds split at the centromere, and a lane draws one
contig. HG00097 and HG02055 assembled it longer than hg38's, and under the 1%
`RUNG_TOLERANCE` of the time `pickRung` framed them at `1.5×` with a third of
the lane blank. Every haplotype's chr12 is one contig within that tolerance.

### 4.11 A long `alsoOn` overflowed an exported figure — fixed

`pickContig` kept every contig at `ALSO_ON_SHARE` (0.2) of the chosen one's
evidence, uncapped. On a chromosome
assembly that is one or two; on a fragmented
one, ten scaffolds each clear the bar against every other. `LaneHeaders.tsx` is
HTML so the label ellipsizes, and `SvgLaneHeaders.tsx:28-37` draws `row.label` as
a bare `<text>` at x=2 with no clip, so the export's header ran under and past
its own scale label — the two presenters saying different things, which
`laneHeader.ts:57-64` says the shared derivation exists to prevent. The cap
landed at the source, where the header, the SVG and the `Show <contig> in this
lane` menu all read one list: `ALSO_ON_MAX = 3` with the remainder counted in
`alsoOnMore`.

## 5. Suitability for graph pangenomes

### 5.1 What the display needs from a graph route

1. **Records per chosen haplotype, not per haplotype in the graph.** The GBZ
   adapter hands the lane selection to the reader as `keep`
   (`GbzBaseSyntenyAdapter.ts`), which calls `Subgraph.keepHaplotypes` on a
   `haplotypes: 'all'` extract; the plugin pins `@gmod/gbz-base` ^4.1.0, which
   ships it. The review's finding is that
   `alignments()` is per path and could take a handle filter today for about a
   quarter of a window's time (`HAPLOTYPE_WALKS_REVIEW.md:45-55`); the
   subgraph fetch itself only shrinks with reference-anchored samples in the
   companion plus a per-path walk (`HAPLOTYPE_WALKS_VISION.md:54-73`).
2. **Stable ids per (haplotype, contig, window)** — provided
   (`GbzBaseSyntenyAdapter.ts:161-163`).
3. **A header lane universe** — provided, 464 entries, grouped by sample.
4. **An assembly and an annotation per lane in the session**, or the lane is
   boxes and "· no annotation". For eight haplotypes `demos/hprc_multiway`
   carries them; for 464 it is a config of 464 GenArk assemblies and 464 CAT
   GFF3s.
5. **A coarse tier or an equivalent**, which the GBZ route has none of
   (`nodeLimit` is the only guard), so chromosome scale is the PIF's job.
6. **Identity**, absent from the reader's records (`GBZ_HANDOFF.md:288-293`), so
   the identity colour mode is dead on a GBZ lane.

The static cut (`gbz-base-query --format gfa --keep`) meets 1 at zero runtime
cost for a fixed locus and set (`HAPLOTYPE_WALKS_VISION.md:94-100`), and is the
right thing for the tutorials now; it does not generalise to a window the reader
chooses.

### 5.2 Row-per-haplotype is not the frame at 464 or 4,000

The design record and the plugin already say so ("464 are not a lane stack",
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"HPRC at scale: lane selection"; "89 lanes is not a lane stack any more than
464 are", `GBZ_HANDOFF.md:298-301`).
The three reasons are independent and each is sufficient:

- *Pixels.* 22 px per lane with a 5 px gene row is not a reading at 464, and a
  scroll does not fix a stack whose information is "which of these rows differ".
- *Fetch.* Every window is the whole cohort until the reader takes a set
  (§5.1), and the walk store the vision proposes still targets "eight lanes
  under a second", not 464 lanes under a second.
- *Picking.* The question at cohort scale is "which haplotypes differ here", a
  genotype/carriage question the alignment cannot answer cheaply; the design
  record lands the same way ("the wave VCF's genotype matrix, not the
  alignment", §"HPRC at scale: lane selection").

At 4-16 haplotypes the frame is right: it is the only display in the tree that
puts each haplotype in its own coordinates with its own genes under a shared
anchor, and the CFH figure is the proof. The honest scaling story is two
surfaces with a hand-off rather than one surface that grows; what those two
surfaces would be is
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"HPRC at scale: lane selection".

### 5.3 Tie-ins to the graph plugin

**`launchFromGraph`** (`P/src/launchFromGraph/launchFromGraph.ts`) launches an
LGV or a `LinearSyntenyView` from the graph selection, choosing contributors by
which sample owns each anchored node (`contributors.ts:97-156`) and keeping only
those that resolve to a loaded session assembly (`:187-195`) — on HPRC that is
the reference alone (`contributors.ts:172-178`). It never constructs a MultiWay
display. The cheap, concrete bridge is: the graph selection's *samples* (every
visitor of the selected nodes is already recorded in `GraphNode.samples`,
`P/packages/core/src/pathAnchoring.ts`) go to `setSelectedLanes` on the
session's multiway track over the same anchor window. That is a menu item and
no new data path, and it is the first place the two views would agree on what a
set of haplotypes is.

**Sample rows** (`P/packages/core/src/layout/sampleRowLayout.ts`) draws
each off-reference node once, in the row of the reference if it visits, else
the *first path in file order* (`pathAnchoring.ts`,
`visits.find(v => v.path === reference) ?? visits[0]`), and keeps the rest in
`samples`. The header comment states the limit: "drawing a segment once per
carrier needs the layout to emit more nodes than the graph has, which the
renderer keys by node id and cannot do" (the header of `sampleRowLayout.ts`). So on a
GBZ cut with every W line it shows *attribution*, and the KIV-2 figure shot from
an eight-haplotype cut showed exactly that. Drawing carriage instead would mean
per-(node, carrier) positions and a renderer key other than node id — and the
result, a row per haplotype with a tube wherever it carries a node, is the
genotype matrix drawn as tubes, which is the reason not to build it there.
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"The graph data path, and what Sample rows should draw" carries what to do
instead.

**The reader.** The 2026-09-06 review found the reader's `align()` and
`gfa_to_pairwise_paf.py` emit different CIGARs for the same walks by design
(`HAPLOTYPE_WALKS_REVIEW.md:280-295`; `50I50D` against `50X`) and nothing measures
them against each other. For this display the difference is invisible where the
CIGAR is dropped after the clip, but it decides the clipped extents where a
record straddles the window edge, and the gap split (§4.1) is the first consumer
of the CIGAR's interior.

## 6. Measured and settled

What the design record's readings measured or decided, moved here once they
stopped being open.

### 6.1 Per-base alignment lanes

The ops pack on the main thread, where the frames already live
(`addAlignmentDetail`), so a lane needs no worker-side frame. Mismatches sharing
a pixel join into one mark, so a gutter emits at most one per pixel of its width
whatever the CIGAR states, the bound `visitCigarRenderedSegments` already gave
the indels. A gutter the file never states is composed from the two records it
sits between (`composeAlignmentOps`), so a star of pairwise alignments draws
every gutter and not just its anchor's.

### 6.2 Lane stability, measured

On the deployed `demos/grape_peach_cacao` — a 2Mb window walked across
grape chr1 in 100kb steps, 259 steps, every lane read out of `decideLaneFrames`
itself with the previous step's decision carried in. A CHANGE IS NOT A FLICKER,
so a lane moving from one syntenic block to the next and staying is counted
apart from one that leaves an answer and comes back within a fifth of a window.

<!-- BEGIN GENERATED MEASUREMENT multiway-lane-stability -->

_Generated by `pnpm autogen` — edit the source, not this block._

| lane        | contigs seen | contig chg | contig osc | drawn flip chg | drawn flip osc | fallback flip chg | fallback flip osc | empty steps | crossed steps | rung chg | rung osc | slip steps | median slip px | max slip px |
| ----------- | -----------: | ---------: | ---------: | -------------: | -------------: | ----------------: | ----------------: | ----------: | ------------: | -------: | -------: | ---------: | -------------: | ----------: |
| peach       |            2 |          3 |          0 |              5 |              0 |                10 |                 2 |          33 |            21 |        6 |        0 |         21 |            297 |       4,705 |
| cacao       |            2 |          4 |          0 |             10 |              1 |                17 |                 2 |          33 |            15 |       17 |        2 |         16 |            248 |         671 |
| citrus      |            3 |          8 |          0 |              7 |              0 |                13 |                 3 |          33 |            14 |        2 |        0 |         17 |            283 |         530 |
| poplar      |            5 |          8 |          0 |              7 |              1 |                14 |                 3 |          33 |             9 |        4 |        0 |         22 |            266 |       3,889 |
| tomato      |            4 |          8 |          0 |              7 |              0 |                12 |                 3 |          33 |            33 |        6 |        0 |         17 |            236 |         737 |
| arabidopsis |            4 |          8 |          0 |              8 |              0 |                15 |                 5 |          34 |            39 |        2 |        0 |         21 |            231 |      12,445 |

<!-- END GENERATED MEASUREMENT multiway-lane-stability -->

That is the 2026-09-24 run of the vote that ships: every pair of shared runs
weighed by the product of group weights, read against the lane above, or
against the anchor where the lane above shares fewer than three groups.
`crossed steps` counts the steps a lane is drawn with more than half its
ribbon pairs to the lane above crossing, read off the drawn frames rather than
any vote, so a rule that holds a lane the wrong way round shows there however
rarely it flips. On 2026-09-21, before the anchor fallback, the same probe with
the vote patched measured three alternatives, lanes in the table's order:

- each run against its neighbour, weighed by the lighter run, the rule before
  2026-09-06: drawn flip changes 3, 4, 5, 7, 8 and 2, no oscillation, crossed
  steps 37, 50, 27, 41, 84 and 55;
- the heaviest collinear chain each way, less its heaviest run: changes 3, 5,
  8, 7, 12 and 9, oscillations 0, 0, 1, 1, 1 and 1, crossed 36, 29, 37, 22, 70
  and 39;
- the shipped rule voting against the anchor rather than the lane above:
  changes 5, 7, 10, 5, 7 and 8, oscillations 0, 0, 1, 1, 0 and 0, crossed 20,
  4, 16, 23, 46 and 51.

No alternative crosses less on any lane. The neighbour rule flipped less
because it held lanes the wrong way round, so its 2026-09-02 table is not a bar
to return to, and the 2026-09-06 change was not a regression.

What the shipped rule does cost is its oscillations, and since lane motion
landed (`MW/laneMotion.ts`) each is a fold out and back rather than two snaps.
In the 2026-09-21 walk, seven of the nine start or end within a step of the
lane above flipping, five of them in one stretch of six steps. A lane votes
against the lane above, so an upper lane's flip inverts the vote of every lane
below that shares its groups, and they follow it out and back. Only two, both
cacao's, are a lane's own near-tie with nothing above it moving. Voting
against the anchor cuts the cascade to two oscillations and pays in the lower
lanes: poplar draws 10 more steps crossed, tomato 11 and arabidopsis 24. A
crossed lane stays wrong for as long as it is held, while an oscillation is one
fold out and back, so the lane-above vote stays.

The anchor fallback landed 2026-09-24. A lane sharing fewer than three groups
with the lane above had taken the unweighted anchor-order sum and no alignment
at all. Against the 2026-09-21 run it cut drawn flip changes from 56 to 49 and
slip steps from 272 to 212 over the six lanes, and cacao's largest slip from
24,234 px to 438, for three more crossed steps and one more oscillation on
arabidopsis and a 12,760 px slip there. On a pairwise star it is the whole vote
below the top lane, and the 17p table below says what that changed.

The `fallback` columns are what the anchor-order sum alone would do, kept as
the control. The stateless version of the same
walk had 1 to 7 flip oscillations per lane and 10 to 21 flip changes, and
arabidopsis changed contig 12 times with 3 of them oscillations. `empty` is
windows where the lane places nothing at all, the same 33 for every lane, and
no rule can fill them. `slip` is how far a lane's content moved on screen
beyond the anchor's own pan, counted only on one contig, orientation and rung:
a held lane slips 0, and each re-alignment is one slip. The medians are the
ordinary re-alignment; the maxima are the kept cluster hopping to another
paleo-block on the same contig, which is a relocation the way a contig change
is.

### 6.3 What the vote reaches on a pairwise source

The 17p figure (`multiway_synteny/hg38_vertebrates_17p_break`,
hg38 chr17:15,200,014-16,400,014 over eight liftOver PIFs) draws each lane
forward or [rev]. `multiwayOrientation17p.probe.ts` reads the same window through the
same adapter with the display's fetch options and runs `decideLaneFrames`
with no incumbent, which is the figure's own state, and puts beside each
lane's answer the anchor bp of its placements on the drawn contig by record
strand:

<!-- BEGIN GENERATED MEASUREMENT multiway-17p-orientation -->

_Generated by `pnpm autogen` — edit the source, not this block._

| lane     | contig | drawn   | fallback | votes against | shared groups | all-pairs bwd | neighbour bwd |      + bp |      - bp | majority |
| -------- | ------ | ------- | -------- | ------------- | ------------: | ------------: | ------------: | --------: | --------: | -------- |
| panTro6  | chr17  | [rev]   | [rev]    | lane above    |             4 |         1.000 |         0.971 |    27,123 | 1,168,258 | - 0.977  |
| calJac4  | chr5   | forward | [rev]    | anchor        |            46 |         0.019 |         0.688 |   582,085 |   597,199 | - 0.506  |
| rheMac10 | chr16  | forward | forward  | anchor        |            12 |         0.075 |         0.270 |   583,055 |   593,900 | - 0.505  |
| ponAbe3  | chr17  | forward | forward  | anchor        |            14 |         0.061 |         0.184 | 1,147,002 |    22,332 | + 0.981  |
| canFam6  | chr5   | forward | [rev]    | anchor        |            11 |         0.105 |         0.792 |   527,509 |   576,664 | - 0.522  |
| bosTau9  | chr19  | forward | [rev]    | anchor        |            11 |         0.153 |         0.340 |   480,205 |   523,228 | - 0.521  |
| mm39     | chr11  | [rev]   | forward  | anchor        |            19 |         0.812 |         0.294 |   440,288 |   487,063 | - 0.525  |
| gorGor6  | chr5   | [rev]   | [rev]    | anchor        |             1 |      abstains |      abstains |         0 |   644,668 | - 1.000  |

<!-- END GENERATED MEASUREMENT multiway-17p-orientation -->

A pairwise record is a group with one mate, so below the top lane a lane
shares no group with the lane above, and until 2026-09-24 every such lane took
the unweighted anchor-order fallback: seven of the eight marks. Three of those
ran against the lane's own weighted order. canFam6 and bosTau9 drew [rev] with
0.119 and 0.164 of their paired evidence backwards, and mm39 drew forward with
0.812. Voting against the anchor draws all three the way their blocks run and
moves no other lane. gorGor6 places one group, so its vote abstains and the
fallback still decides it.

The strand columns do not decide a lane. The flip mirrors a lane so its blocks
read in the anchor's order, and block order and record strand part ways
wherever a region was rearranged: mm39 runs 0.812 backwards in order on a
0.525 strand majority. Five of the eight lanes sit within three points of even
on strand.

### 6.4 A broken hold re-aligns

When a hold breaks — the lane's content has moved to another block, or the
frame shows under 90% of what a fresh alignment would — the lane jumps to its
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

### 6.5 The next render lever is the cell rebuild

A zoom step is
2.0 ms of React and 12.7 ms of MobX packing the cells, so if a lever is wanted
it is that rebuild.

### 6.6 What this shares with SyntenyFollow

Both answer
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

### 6.7 What not to reopen

The 2026-09-06 reading ends with a list of what it found
sound and would not have anyone reopen: the lane decision and its hysteresis;
the cell/layer renderer and its parity tests; the gene glyph parity with the
canvas track; the per-lane staleness on the dependent fetches; the lane picker
at its current scale; and the E. coli and primate demos as they stand.
