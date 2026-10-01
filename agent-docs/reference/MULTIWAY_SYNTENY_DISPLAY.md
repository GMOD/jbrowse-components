---
name: multiway-synteny-display
description: What MultiWaySyntenyDisplay is — the lane stack and its frames, the adapter contract, the two tutorials it serves, its cost per lane, and its ceiling for graph pangenomes. Read before changing its placement, ordering, LOD gating or launch route.
kind: spec
---

# MultiWaySyntenyDisplay: what it is, what it costs, where it stops

MultiWaySyntenyDisplay is a per-window, anchor-star, one-affine-frame-per-genome
lane stack inside an ordinary LinearGenomeView. This file states the data model,
the adapter contract, the cost of a lane, the invariants earlier reviews
settled, and how far the frame carries toward a graph pangenome. What is
unbuilt or undecided lives in
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md),
the design record this file cites by section name.

`MW/` below is `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/`.
The graph adapter lives in the graph plugin (`jbrowse-plugin-graphgenomeviewer`),
the reader in `@gmod/gbz-base`. Symbols are cited by name; the code moves.

## The verdict

The frame fits a gene table over dozens of genomes and a star of pairwise
alignments over one locus. It is the wrong frame, unmodified, for more than one
row of content per genome and for cohorts of hundreds of haplotypes, where every
cost is linear in lanes (§5.2).

## Settled invariants — do not re-fix

- **Alignment records split at large indels.** `SPLIT_AT_GAP_BP` rides the
  anchor and pair fetches through `clipFeatureToRegion`, so each gap-free run is
  its own group. Every gutter draws the record's own ops: the anchor's from the
  record, a lower one's composed from the two records it sits between
  (`composeAlignmentOps`). Mismatches sharing a pixel draw as one mark.
- **Strand means the record's strand**, never the drawn twist, in the config
  schema, the `Color ribbons by` help and `multiwayGeometry.ts`.
- **Lanes sort by their heaviest contig's group weight** (`rowAssembliesOf`), not
  placement count, which rewards a haplotype whose alignment breaks. Ties break
  on first-seen order, so `ComparativeAdapterBase` emits per-region streams in
  region order and `MultiGenomeIndexedPAFAdapter` sorts reads by `fileOffset`.
- **A star launch seeds from the display's lanes** (`lanePanelsForRegion`) and
  offers **Repeat ⟨anchor⟩ between panels** so every band is a direct pair.
- **The LOD menu leaves a source with no coarse tier** (`lodMenuGate.test.ts`).
- **A re-anchor drops the old genome's pivot and flip**: the ortholog answer is
  held beside the anchor its fetch asked for (`fetchedFeatures`).
- **Tied lanes do not reorder with network arrival.** Lane labels use the
  session's display name, else a plugin's description, else the declared label.
- **`pickContig` caps `alsoOn`** at `ALSO_ON_MAX`, so the HTML header and the SVG
  export, which draws `row.label` unclipped, read one list.
- **The alignment shift is unclamped** (`alignFrameTo`): a frame may start below
  zero while the header, ticks and gene fetch stop there. The anchor seed
  `anchorAbsX` is the centre of what the viewport shows of each group; seeding
  at the whole record's centre slid long-record lanes toward their overhang.
- **A gutter stacks its ribbons' alpha**, as the pairwise band does. A
  strongest-ribbon `min` blend flattened overlap shading and drew the first
  gutter short, so we removed it.

Open items are in the ideas file.

## 1. What the display actually is

### 1.1 The data model

**One fetch.** `fetchPhases` (`MW/afterAttach.ts`) issues one
`MultiWayGetFeatures` over the anchor's merged static blocks with
`opts: { mateShape: 'grouped', lodMode, clipToRegion: true, splitAtGapBp }` and
no `targetAssemblyName`, so the adapter answers with every pair anchored on the
queried assembly. The RPC lifts each piece's packed alignment ops out of the
feature and returns them beside it by id, because a details panel freezes and a
session stringifies what it holds, and neither can hold a typed array. The lane
selection reaches the fetch as `haplotypes` only for an adapter that declares
its lanes (`fetchLaneSelection`); elsewhere `laneSelection` filters
`rowAssemblies` locally. Before a reader chooses, a lane-declaring source opens
on the track's `assemblyNames` beside the anchor (`configuredLanes`).

**Groups.** `groupFeatures` (`MW/layoutMultiWay.ts`) folds features into
`MultiWayGroup { key, anchor, mates, feature, weight }`. The key is `name`, else
`syntenyId`, else `feature.id()` (`groupKeyOf`): a named table chains a gene
across every lane, an alignment source makes every clipped record its own group.
Each gap-free run is its own group, since runs as placements of one group would
draw a cross product. A mate's `orientation` is the pair's strand
(`MatePlacement`), never the mate's transcription strand. `weight` is anchor bp
for a nameless record and one per gene for a named one (`voteEvidence`).

**Lanes.** `rowAssembliesOf` orders mate assemblies by summed group weight on
each lane's heaviest contig over the whole fetched block set, then pins
`domain`. The model's `rowAssemblies` keeps the lanes `laneUniverse` marks
`drawn`, compared on canonical names (`laneKey`). `laneFilter` holds `{ only }`
(the picker; replaces `configuredLanes` as `laneSelection`) or `{ except }`
(Hide lane, when no `only` is in force). An `except` lane stays in the fetch, so
a hide refetches nothing. `laneUniverse` is the header's declared `lanes`, then
the track's `assemblyNames`, then anything the window placed. The header is read
only when the adapter tiers or declares `adapterCapabilities: ['headerLanes']`
(`adapterDeclaresLanes`, `installLodTierInfoFetch`).

**Frames.** `decideLaneFrames` (`MW/laneDecision.ts`) walks lanes top down once
per settled block set:

- contig by `preferIncumbent` (`syntenyHysteresis.ts`);
- extent by `keepNearMedian` (`OUTLIER_REACH`);
- rung off `SCALE_LADDER` with `RUNG_TOLERANCE` (`pickRung`);
- orientation by a vote over shared groups against the lane above, with a
  deadband against an incumbent and the anchor-order sign for a fresh lane
  sharing too few (`orientationVote`, `decideOrientation`);
- offset by the weighted-median displacement to the lane above, unclamped
  (`alignFrameTo`). Both vote and offset read against the anchor where the lane
  above shares fewer than three groups, which on a pairwise star is every lane
  below the first;
- a placement hold while the frame still shows `HOLD_COVERAGE` of the weight a
  fresh alignment would.

Two lane-menu pins outrank the vote: a contig pin (`pinnedLaneContigs`) while the
window places anything on that contig, and a flip pin (`pinnedLaneFlips`) while
the lane draws the contig it was set on. A released pin leaves no incumbent.
Flip pins are held per anchor (`laneFlipPinsByAnchor`), so a return to an anchor
finds them. The decision is stored as data and the drawn frame derives from it
against the live view on every pan (`frameFromDecision`, the model's
`rowFrames`). A mate lane draws its frame plus half a span either side
(`frameReach`), the margin a pan translates into view before re-layout, while
placements stay filtered at the frame edge (`groupRunsOnRow`). This machinery is
measured (§6.2) and is the best-engineered part of the display.

**Transitions.** A settle that re-decides a lane onto the contig it already draws
moves the lane over `MORPH_DURATION_MS` (`laneTransitionsAfter`,
`MW/laneMotion.ts`), as a per-lane map in the render state (`laneMaps`) that
uploads nothing; the lane carries its source frames (`RowFrame.morphFrom`) and
culls to all of them. A contig change, a first decision, a jump whose pictures
share nothing, a sub-pixel move, and `animationAllowed` saying no all snap. The
model publishes `animating` for capture waits, and a deadline in `afterAttach.ts`
ends every transition whatever the frame clock did.

**Lane genes.** `laneGeneTracks` walks every session track (connections
included) and keeps, per lane, the track the `laneGeneTracks` slot names, else
the best-ranked single-assembly annotation track by adapter type
(`MW/laneAnnotation.ts`); the slot exists because a hub can tie on rank. One
`CoreGetFeatures` per lane over `laneFetchRegion(frame)` — the window the frame
can slide in plus its reach, snapped to a power-of-two grid off the rung span —
runs concurrently with per-lane staleness, so a pan re-asks only lanes whose
grid cell moved (`installLaneFetch`). A lane gets one when the session holds its
assembly (`laneGenesFetchSpecs`).

**Lanes the session lacks.** A hub star's mates live in other hubs' configs. The
display puts its drawn, unheld lanes to `Core-describeAssemblies` in one batch
(`lanesToDescribe`) and never calls `assemblyManager.get` for them, which fires
`Core-handleUnrecognizedAssembly` per lane and makes the Hubs plugin connect each
genome's whole config. A description is the assembly config and its gene
adapter. The display holds the assembly as a temporary one while it draws the
lane (`installLaneAssemblies`), so every fetch renames through it and
`loadRefNameMap`'s `CoreGetRefNames` primes the adapter with the genome's
sequence. **Nothing hands an adapter its sequence**: no RPC passes one, and
renaming keeps none a caller passes. We declined per-lane gene adapters written
into the star config.

The display returns temporary assemblies through the session it captured at
attach, since a display is destroyed after its view detaches. "Open in new view"
returns one first, so the new view's hub connects it. A restored session brings
temporary assemblies back without gene adapters, so those lanes are described
again. A pending answer holds readiness until it lands or `DESCRIBE_DEADLINE_MS`
passes. The Hubs plugin answers from each genome's hosted config with no
connection; chromosome spelling follows jb2hubs' `defaultGeneTrackId`, so a
GenArk-backed db draws only through the aliases.

**Lane layers.** `laneLayers` declares rows of data every lane draws between its
header and its genes, each on one value scale shared by all lanes
(`laneLayerDomains`). A lane reads a layer from the `tracks` entry on its
genome, else from the layer's `adapter`, a template of a type declaring
`READS_REFERENCE` that the adapter cache keys per genome's sequence. A template
reads a lane only while each region is under `LANE_TEMPLATE_MAX_BP`, since the
region is the sequence it downloads. An adapter type that computes from no
sequence is no template, because every lane would read one file at its own
coordinates.

**Lane links.** For a source whose features carry no `name` and whose header
names no `anchorAssemblyName`, one `CoreGetFeatures` per adjacent lane pair the
session holds both assemblies of, on the upper lane's window with
`targetAssemblyName: lower` (`laneLinksFetchSpecs`). An adapter declaring
`adapterCapabilities: ['lanePairsOnAnchor']` is asked for every adjacent pair on
the anchor's merged blocks, since it cuts a graph on its reference alone, and
answers with the alignment the graph records between the two walks. `pairLinks`
composes a pair's links through the anchor (`MW/composeLaneLinks.ts`) where a
star holds no direct records, a fetch came back empty or failed, or the session
lacks an assembly. `composeLaneLinks` steps two records that carry ops through
each other and interpolates any other between its clipped ends
(`projectOntoLane`). Composition through GRCh38 loses the loci picked for being
absent from it, which is why a graph adapter's lane pair is the alignment
`pairAlignments` reads off the graph:

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

Chained shared runs (`sharedRuns`, `chainRuns` in gbz-base) track the set count
wherever a node is visited once; a tandem array is the limit.

**Rendering.** Cells are keyed by identity: `bands`, `ribbons:<row>` per gutter
plus `ribbons:<row>><toRow>` per bridge, `ticks:<row>`, `glyphs:<row>` and
`boxes:<row>` per lane (`MW/multiwayGeometry.ts`). Ribbons ride the pairwise
synteny marks and lanes the feature track's glyph marks, one list
(`MULTIWAY_MARKS`) that `MW/MultiWayRenderer.ts` hands to `createMarkBackend`. A
pan is one translate (`dragOffsetPx`).

**LOD.** `lodTier` resolves on the main thread off the settled zoom and
`coarseBpPerPxThreshold` (`lodTierAt`) and enters `viewSignature`. The tier
changes no extent here: coarse rows keep extents with folded CIGARs.

### 1.2 What an adapter must provide

The display asks for:

- (a) anchor-with-no-target records, each clipped to the window on both axes
  (`comparative-adapters/src/clipFeatureToRegion.ts`; CIGAR-exact when the
  record carries one, proportional otherwise), cut at every `SPLIT_AT_GAP_BP`
  indel into one feature per gap-free run, CIGAR dropped after the clip. A
  nameless record's group key is its id, so a source answering per window must
  mint the same id for the same run on every refetch, or the clicked outline and
  hover re-resolve to another group; `clipToRegion`'s region suffix is the
  pattern;
- (b) optionally, direct records for a mate pair, on the upper lane's window or,
  with `lanePairsOnAnchor`, the anchor's;
- (c) a `CoreGetInfo` header with `hasCoarseTier`, optionally
  `anchorAssemblyName` and `lanes[{name,label,group}]` (`starAnchorOf`,
  `declaredLanesOf`).

Providers:

- `MCScanBlocksAdapter` reads the whole table up front, answers any column pair,
  and is the only adapter implementing `mateShape: 'grouped'`.
- `MultiPairwiseSyntenyAdapter` wraps N pairwise PIF children, emitted in child
  order with ids re-keyed `${childIndex}-…`. The header folds the children's
  tiers ([SYNTENY_LOD.md](SYNTENY_LOD.md)), names the anchor, and declares every
  mate as a lane. It declares `headerLanes`, so a window reads only the
  children for the lanes asked (`childrenForLanes`); the fetch carries the lanes
  beside its regions so the rename pass loads a map per selection
  (`refNameMapKey`). PIF adapters ignore `mateShape: 'grouped'`, so the display
  groups on the clipped `syntenyId`. A mate-vs-mate query returns the empty
  answer, not an error.
- `MultiGenomePAFAdapter` and `MultiGenomeIndexedPAFAdapter` read one PanSN file.
  The in-memory adapter raises `noSuchPairError` for an unstated pair, which the
  lane-links fetch stamps empty; the indexed one cannot tell an unstated pair
  from an empty window and answers empty.
- `GbzBaseSyntenyAdapter` (graph plugin) is anchor-only: it emits nothing for a
  lane-assembly region. With `queryAssemblyName` it answers `lanePairsOnAnchor`
  from the graph's own alignment of the two walks. gbz-base keeps its aligner,
  `Subgraph.pairAlignments`, in its CLI, where a host runs it offline and serves
  a file. Header `lanes` is every haplotype minus the reference;
  `hasCoarseTier: false`; no `identity`; the lane selection goes to gbz-base as
  `keep` (`keepPredicate`).

### 1.3 Where the "one gene row per lane" simplification lives

A lane is `Lane` in `MW/laneStack.ts`: an assembly name, a frame, a
`hasAnnotation` flag, the group placements in px, and two functions. The session
does not know lanes exist.

- One annotation per lane, the raw adapter re-drawn through `geneGlyph.ts`.
  ADR-180 makes a lane a list of grammar layers drawn through its frame, which is
  how a second row arrives; gene names are the first (`showGeneLabels`).
- No per-lane navigation or zoom: lanes re-fit to the anchor's viewport.
- One contig per lane (`pickContig`); a second copy is named in the header and
  reachable by pin (design record §"Multi-copy lanes").
- Self-comparison lanes are dropped (`rowAssemblies`).
- The SVG export is the viewport at the current `scrollTop`, not the stack.
- Height divides until `MIN_LANE_PITCH`, then fixes and scrolls
  (`laneContentHeight`).

Two escape hatches: **Open ⟨assembly⟩ at the matching region** (`openInNewView`)
opens an unsynchronised LGV with the multiway track and the lane's gene track,
and **Launch → Linear synteny view (visible region)** (`trackMenuItems`) builds
the stacked view §2.3 costs out.

## 2. The two named tutorials

### 2.1 `ecoli_orthologs_synteny` (E. coli and Shigella under K-12)

A gene-symbol join over RefSeq GFF3s written as an MCScan `.blocks` table, one
column per genome; each lane's genes come from its own tabix GFF3.
`MW/laneStack.test.ts` pins that every checked-in demo sizes its track to the
whole stack. This is the case the display was built for: group keys are gene
symbols, so one anchor gene chains through every lane, `bridgeSkippedLanes`
carries a group past a lane that lacks it, and `{ field: 'cluster' }` paints a
conserved gene one colour down the stack. It reads as a barcode at this lane
count, and past about 500 kb bridged ribbons sweep the track
([DEMO_DATASETS.md](DEMO_DATASETS.md)). Order is density, not phylogeny; a tree
order is designed, not built
([../ideas/waiting-on-a-call/ordering-synteny-lanes-by-similarity.md](../ideas/waiting-on-a-call/ordering-synteny-lanes-by-similarity.md)).

### 2.2 `hg38_vertebrates_synteny` (hg38 and eight UCSC genomes)

A `MultiPairwiseSyntenyAdapter` over UCSC liftOver chains converted to PIF, with
hub assemblies and `ncbiRefSeq` tracks lifted from each genome's hub config.
Each PIF carries a coarse tier ([DEMO_DATASETS.md](DEMO_DATASETS.md)).

A liftOver chain is one whole-chromosome record, so a small window places each
lane with one record whose CIGAR carries thousands of gaps. Before the gap split,
the display drew that record as one parallelogram, and the straightness read as
conservation while it was blindness to the CIGAR. Composed links interpolated
and could sit far from the alignment, and the `identity` colour mode cannot
rescue one, since a composed link carries no `identity` (`ribbonColorer`).

Only the anchor-to-first-mate gutter comes from group placements; below it the
ribbons are composed links (`buildRibbonGeometry`, `row > 0`). The fine tier
pulls the whole chain row per lane per window, so the coarse tier is the byte
lever (`../measurements/pif-tier-wire-bytes.json`); the display cannot ask for
coarse on its own behalf.

**The launched stack from a star.** A stacked view has no notion of "every level
anchored on the hub": a level is `views[i]`/`views[i+1]` in many files, and
mate-vs-mate returns nothing from `MultiPairwiseSyntenyAdapter`
(`noSuchPairError` from a `MultiGenomePAFAdapter`). **Repeat ⟨anchor⟩ between
panels** makes every band a direct pair. Each level instantiates its own track,
display and backend, with heights budgeted in `levelHeightBudget.ts`.
`lanePanelsForRegion` keeps the reader's lane selection where the older
`SyntenyDiscoverMates` route forgot it.

### 2.3 The two routes, costed

| | MultiWay lanes (one track) | LinearSyntenyView (one LGV per row) |
| --- | --- | --- |
| **Control** | Order, hide, pick, pin, flip, re-anchor; no per-lane zoom or extra tracks | Full LGV per row: any tracks, independent navigation; no bridging, no lane picker |
| **State** | `domain`, `laneFilter`, `lodMode` on one display | N LGV plus N-1 `LinearSyntenyLevel` models, each with its own track, display and backend |
| **Fetches** | 1 star fetch plus N lane-gene and N-1 link RPCs | N-1 synteny fetches plus each row's own tracks |
| **Correctness** | Affine lane frames; composed links interpolate | CIGAR-exact per level; for a star only levels touching the anchor draw |
| **Scale** | Linear in N, readable to about 50 with scrolling | Usable to about 5 rows |

A stacked view is N independent navigators tied by adjacent-pair bands, so the
one thing the lane stack does for free, pinning every genome to the anchor's
viewport, is what the stack cannot do.

## 3. Speed and scalability

N is the number of mate lanes drawn after selection.

- **Fetches per settle:** one ortholog fetch (`fetchPhases`); N child tabix reads
  inside a `MultiPairwise` star (`childrenForLanes`); every haplotype in the
  window inside GBZ regardless of N; N+1 lane-gene RPCs (`laneGenesFetchSpecs`);
  N-1 lane-link RPCs (`laneLinksFetchSpecs`); one header read. Lane-gene and
  lane-link fetches use per-lane staleness, so a pan that moves one grid cell
  costs one RPC, the one sub-linear place in the display.
- **Main thread:** `decideLaneFrames` is O(N × G log G) and `pairLinks`
  recomposes every pair on each fetch commit, O(N × records).
  `multiwayZoomCost.probe.ts` measures the cell packing, the render lever.
- **Rendering:** `renderLayers` is bands, N gutters plus bridges, N tick layers
  and 2N glyph layers, a draw per mark, about ten draw calls per lane whatever
  is on screen. Nothing culls layers scrolled out of the viewport. The pick does
  not draw: `pickRibbonAt` walks `ribbonRegions` through `createSyntenyPicker`
  ([SYNTENY_LOD.md](SYNTENY_LOD.md)).
- **Pixels and session:** a scrolled stack is still fully drawn. A lane draws
  genes only if the session holds its assembly (`holdsAssembly`) or a plugin
  describes it, so a cohort config without a describing plugin needs one assembly
  and one annotation track per haplotype
  ([PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md)).
- **Picker:** `LaneSelectionDialog` is a flat checkbox list that re-renders every
  row per tick: fine at hundreds, a wall at thousands, with no "which haplotypes
  differ here".
- **What breaks first:** for a gene table, the lane-gene fan-out and glyph cell
  rebuild; for a PIF star, fine-tier bytes, then draw calls; for GBZ, the fetch
  (every haplotype per window, `nodeLimit` refusing wide windows, no coarse
  tier), which lane selection does not reduce.

## 4. Correctness: checked and sound

- **Lane-link tier on a mate lane.** The pair fetch uses the anchor's tier while
  the lane may draw at a larger bp/px. The ladder only zooms a lane out, so the
  tier is never wrong output; at worst it costs fine bytes.
- **Coordinates and inversions.** Mate orientation reads from the pair
  (`layoutMultiWay.test.ts`). An inversion is an ordered span pair joined end to
  end, so two lanes both reversed against the anchor draw straight between
  themselves (`groupRunSpansOnRow`). A direct link reverses its lower span on `-`
  strand against lanes mirrored by `rowFrameX`. The anchor axis clips rather than
  tests (`axisPlacement`). A flipped view mirrors every lane without re-deciding
  (`frameFromDecision`). Coordinates are chromosome-local, no 2^32 issue.

## 5. Suitability for graph pangenomes

### 5.1 What the display needs from a graph route

1. **Records per chosen haplotype**, not per haplotype in the graph. The GBZ
   adapter hands the lane selection to the reader as `keep`
   (`Subgraph.keepHaplotypes`); the subgraph fetch itself only shrinks with
   reference-anchored samples in the companion plus a per-path walk.
2. **Stable ids per (haplotype, contig, window).** Provided.
3. **A header lane universe**, grouped by sample. Provided.
4. **An assembly and an annotation per lane in the session**, or the lane is
   boxes and "· no annotation".
5. **A coarse tier or equivalent.** The GBZ route has none (`nodeLimit` is the
   only guard), so chromosome scale is the PIF's job.
6. **Identity.** The reader's records carry none, so the identity colour mode is
   dead on a GBZ lane.

The static cut (`gbz-base-query --format gfa --keep`) meets item 1 at zero
runtime cost for a fixed locus and set; it does not generalise to a window the
reader chooses.

### 5.2 Row-per-haplotype is not the frame at cohort scale

Three independent reasons, each sufficient
([../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"HPRC at scale: lane selection"): a fixed pitch is no reading at hundreds of
lanes; every window fetches the whole cohort until the reader takes a set; and
the cohort question, "which haplotypes differ here", is a genotype question the
alignment cannot answer cheaply. At a handful of haplotypes the frame is right:
it is the only display that puts each haplotype in its own coordinates with its
own genes under a shared anchor. The scaling story is two surfaces with a
hand-off, not one surface that grows.

### 5.3 Tie-ins to the graph plugin

**`launchFromGraph`** launches an LGV or `LinearSyntenyView` from the graph
selection and never constructs a MultiWay display. The cheap bridge is to send
the selection's samples (`GraphNode.samples`) to `setSelectedLanes` on the
session's multiway track over the same anchor window: a menu item with no new
data path.

**Sample rows** (`sampleRowLayout.ts`) draw each off-reference node once, in the
reference's row if it visits, else the first path in file order, so a GBZ cut
shows attribution, not carriage. Drawing carriage needs per-(node, carrier)
positions and a renderer key other than node id, and the result is the genotype
matrix drawn as tubes, the reason not to build it there
(ideas file, §"The graph data path, and what Sample rows should draw").

**The reader's CIGARs.** The reader's `align()` and `gfa_to_pairwise_paf.py`
emit different CIGARs for the same walks by design (`50I50D` against `50X`), and
nothing measures them against each other. The difference decides clipped extents
where a record straddles the window edge, and the gap split consumes the CIGAR's
interior.

## 6. Measured and settled

### 6.1 Per-base alignment lanes

The ops pack on the main thread, where the frames live (`addAlignmentDetail`), so
a lane needs no worker-side frame. Mismatches sharing a pixel join into one mark,
bounding a gutter's marks by its pixel width whatever the CIGAR states.

### 6.2 Lane stability

`multiwayLaneStability` walks a window across grape chr1 on the deployed
`demos/grape_peach_cacao`, reading every lane out of `decideLaneFrames` with the
previous decision carried in. A lane moving from one block to the next and
staying counts apart from one that leaves an answer and comes back within a fifth
of a window.

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

`crossed steps` counts steps where a lane is drawn with more than half its
ribbon pairs to the lane above crossing, read off the drawn frames, so a rule
that holds a lane the wrong way round shows there however rarely it flips. The
`fallback` columns are the anchor-order sum alone, kept as the control. `empty`
is windows where the lane places nothing. `slip` is how far a lane's content
moved beyond the anchor's pan on one contig, orientation and rung; each
re-alignment is one slip, and maxima are the kept cluster hopping to another
paleo-block.

The shipped vote weighs every pair of shared runs by the product of group
weights, against the lane above, or the anchor where the lane above shares fewer
than three groups. We measured three alternatives and rejected them: the
neighbour rule weighted by the lighter run, the heaviest collinear chain each
way, and voting against the anchor throughout. None crosses less on any lane;
the neighbour rule flipped less only because it held lanes the wrong way round.
The shipped rule costs oscillations that cascade, since an upper lane's flip
inverts the vote of lanes below. Voting against the anchor everywhere cuts the
cascade but leaves lower lanes crossed for as long as they are held, while an
oscillation is one fold, so the lane-above vote stays.

### 6.3 What the vote reaches on a pairwise source

A pairwise record is a group with one mate, so below the top lane a lane shares
no group with the lane above and votes against the anchor.
`multiwayOrientation17p.probe.ts` reads the 17p figure's window
(`multiway_synteny/hg38_vertebrates_17p_break`) with no incumbent and sets each
lane's answer beside its placements by record strand:

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

The unweighted anchor-order sign drew three lanes against their own weighted
order; the anchor vote draws them the way their blocks run. A lane placing one
group abstains and the fallback decides it. The strand columns do not decide a
lane: block order and record strand part ways wherever a region was
rearranged.

### 6.4 A broken hold re-aligns

When a hold breaks, the lane jumps to its re-alignment in one step. Sliding only
as far as restores coverage fails: the least slide leaves a placement's centre on
the frame edge, the next pan pushes it out and the slide brings it back, so the
lane pins to that placement and stops panning with the anchor. Both rules travel
the same total distance, so the rule only chooses between rare re-alignments and
pinned creeping, and re-alignment stays. A zoom is a scale about the pivot, so a
rung change re-aligns only when the rescaled frame no longer shows the content.

### 6.5 What this shares with SyntenyFollow

`SyntenyFollow` navigates a real LGV panel; this display holds a lane-local
affine frame at a fixed viewport. A `RowFrame` is one linear ramp over one
refName and a followed row is a `displayedRegions` layout, so the shapes do not
unify. The near-twin is the launch: `interpolateFollowSpan` and the CIGAR-less
branch of `resolvePanel`'s `resolveSpans` are one clamp-to-block interpolation.

Three things crossed. `computeRowFrame` weighs a contig by anchor bp, as
`resolvePanel` does, so short repeat hits cannot put a lane on another contig
than the launched panel. `frameSpan` clips rather than tests, because
`followWindowMapping` refuses to extrapolate past its outermost block. And
`axisSpan`, built on core's `clipToDisplayedRegions`, keeps an interval
straddling a displayed-region edge, which `bpToPx` drops whole; that shows only
where `displayedRegions` is a slice of a contig.

### 6.6 What not to reopen

The lane decision and its hysteresis; the cell/layer renderer and its parity
tests; gene glyph parity with the canvas track; per-lane staleness on the
dependent fetches; the lane picker at its current scale; and the E. coli and
primate demos as they stand.
