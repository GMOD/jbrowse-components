---
name: multiway-synteny-display
description: What are MultiWaySyntenyDisplay's settled invariants, adapter contract and cost model, and where does the lane frame stop for graph pangenomes? Read before changing its placement, ordering, LOD gating or launch route.
kind: spec
---

# MultiWaySyntenyDisplay: invariants, contract, ceiling

MultiWaySyntenyDisplay is a per-window, anchor-star, one-affine-frame-per-genome
lane stack inside an ordinary LinearGenomeView. Unbuilt and undecided work lives
in
[../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md),
the design record this file cites by section name.

`MW/` below is `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/`. The
graph adapter lives in the graph plugin (`jbrowse-plugin-graphgenomeviewer`), the
reader in `@gmod/gbz-base`.

The frame fits a gene table over dozens of genomes and a star of pairwise
alignments over one locus. It is the wrong frame, unmodified, for more than one
row of content per genome and for cohorts of hundreds of haplotypes, where every
cost is linear in lanes.

## Settled invariants — do not re-fix

- **Alignment records split at large indels.** `SPLIT_AT_GAP_BP` rides the anchor
  and pair fetches through `clipFeatureToRegion`, so each gap-free run is its own
  group (runs as placements of one group would draw a cross product). Every
  gutter draws the record's own ops: the anchor's from the record, a lower one's
  composed from the two records it sits between (`composeAlignmentOps`).
- **Strand means the record's strand**, never the drawn twist, in the config
  schema, the `Color ribbons by` help and `multiwayGeometry.ts`. A mate's
  `orientation` is the pair's strand, never the mate's transcription strand.
- **Lanes sort by their heaviest contig's group weight** (`rowAssembliesOf`), not
  placement count, which rewards a haplotype whose alignment breaks. Ties break on
  first-seen order, so `ComparativeAdapterBase` emits per-region streams in region
  order and `MultiGenomeIndexedPAFAdapter` sorts reads by `fileOffset`. Tied lanes
  do not reorder with network arrival.
- **A star launch seeds from the display's lanes** (`lanePanelsForRegion`) and
  offers **Repeat ⟨anchor⟩ between panels** so every band is a direct pair. A
  stacked view has no notion of "every level anchored on the hub", and mate-vs-mate
  returns nothing from `MultiPairwiseSyntenyAdapter`.
- **The LOD menu leaves a source with no coarse tier** (`lodMenuGate.test.ts`).
- **A re-anchor drops the old genome's pivot and flip**: the ortholog answer is
  held beside the anchor its fetch asked for (`fetchedFeatures`).
- **`pickContig` caps `alsoOn`** at `ALSO_ON_MAX`, so the HTML header and the SVG
  export, which draws `row.label` unclipped, read one list.
- **The alignment shift is unclamped** (`alignFrameTo`): a frame may start below
  zero while the header, ticks and gene fetch stop there. The anchor seed
  `anchorAbsX` is the centre of what the viewport shows of each group; seeding at
  the whole record's centre slid long-record lanes toward their overhang.
- **A gutter stacks its ribbons' alpha**, as the pairwise band does. A
  strongest-ribbon `min` blend flattened overlap shading and drew the first gutter
  short, so we removed it.
- **Nothing hands an adapter its sequence**: no RPC passes one, and renaming keeps
  none a caller passes. The display holds a lane's assembly as a temporary one
  (`installLaneAssemblies`) so `loadRefNameMap`'s `CoreGetRefNames` primes the
  adapter with the genome's sequence. We declined per-lane gene adapters written
  into the star config.
- **Never call `assemblyManager.get` for a lane the session lacks.** It fires
  `Core-handleUnrecognizedAssembly` per lane and makes the Hubs plugin connect each
  genome's whole config. The display puts them to `Core-describeAssemblies` in one
  batch (`lanesToDescribe`). Temporary assemblies return through the session
  captured at attach, since a display is destroyed after its view detaches;
  "Open in new view" returns one first. A GenArk-backed db draws only through the
  aliases (jb2hubs' `defaultGeneTrackId` spelling).
- **A lane template reads a lane only while each region is under
  `LANE_TEMPLATE_MAX_BP`**, since the region is the sequence it downloads. An
  adapter type that computes from no sequence is no template (every lane would read
  one file at its own coordinates).
- **`laneFilter.except` lanes stay in the fetch**, so a hide refetches nothing.
- **An adapter's header is read only when it tiers or declares
  `adapterCapabilities: ['headerLanes']`** (`adapterDeclaresLanes`).
- **A nameless record's group key is its id**, so a source answering per window
  must mint the same id for the same run on every refetch, or the clicked outline
  and hover re-resolve to another group (`clipToRegion`'s region suffix is the
  pattern).
- **A flip pin and contig pin outrank the vote** (`pinnedLaneFlips`,
  `pinnedLaneContigs`); a released pin leaves no incumbent. The decision is stored
  as data and the drawn frame derives from it against the live view on every pan
  (`frameFromDecision`, `rowFrames`).

## Where things live

- **One fetch**: `fetchPhases` (`MW/afterAttach.ts`) issues one
  `MultiWayGetFeatures` with `mateShape: 'grouped'` and no `targetAssemblyName`.
  The RPC lifts packed alignment ops out of each feature and returns them beside
  it by id, because a details panel freezes and a session stringifies what it
  holds, and neither can hold a typed array.
- **Groups**: `groupFeatures` (`MW/layoutMultiWay.ts`), keyed by `groupKeyOf`
  (`name`, else `syntenyId`, else `feature.id()`). `weight` is anchor bp for a
  nameless record and one per gene for a named one (`voteEvidence`).
- **Lanes**: `rowAssembliesOf`, `laneUniverse`, `laneFilter` (`{ only }` or
  `{ except }`).
- **Frames**: `decideLaneFrames` (`MW/laneDecision.ts`) decides contig
  (`preferIncumbent`), extent (`keepNearMedian`), rung (`pickRung`), orientation
  (`orientationVote`, `decideOrientation`), offset (`alignFrameTo`) and the
  placement hold (`HOLD_COVERAGE`). Vote and offset read against the anchor where
  the lane above shares fewer than three groups, which on a pairwise star is every
  lane below the first.
- **Transitions**: `laneTransitionsAfter` (`MW/laneMotion.ts`), per-lane maps in
  the render state (`laneMaps`); a deadline in `afterAttach.ts` ends every
  transition whatever the frame clock did.
- **Lane genes**: `laneGeneTracks` (`MW/laneAnnotation.ts`) with the
  `laneGeneTracks` slot for ties; `installLaneFetch` re-asks only lanes whose
  `laneFetchRegion` grid cell moved.
- **Lane layers**: `laneLayers` / `laneLayerDomains` (one value scale shared by all
  lanes).
- **Lane links**: `laneLinksFetchSpecs`; `lanePairsOnAnchor` adapters are asked for
  every adjacent pair on the anchor's merged blocks. `pairLinks` composes a pair's
  links through the anchor (`MW/composeLaneLinks.ts`) where the star holds no
  direct record. Composition through GRCh38 loses the loci picked for being absent
  from it, which is why a graph adapter's lane pair is the alignment
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

- **Rendering**: cells keyed by identity (`MW/multiwayGeometry.ts`); one mark list
  (`MULTIWAY_MARKS`) handed to `createMarkBackend` by `MW/MultiWayRenderer.ts`; a
  pan is one translate (`dragOffsetPx`).
- **LOD**: `lodTier` resolves on the main thread (`lodTierAt`) and enters
  `viewSignature`. The tier changes no extent here.
- **One lane is `Lane`** (`MW/laneStack.ts`); the session does not know lanes
  exist. One annotation per lane through `geneGlyph.ts` (ADR-180 makes a lane a
  list of grammar layers); one contig per lane (`pickContig`, a second copy
  reachable by pin); no per-lane zoom. **Open ⟨assembly⟩ at the matching region**
  (`openInNewView`) and **Launch -> Linear synteny view** (`trackMenuItems`) are
  the escape hatches.

## What an adapter must provide

- (a) anchor-with-no-target records, clipped to the window on both axes
  (`comparative-adapters/src/clipFeatureToRegion.ts`), cut at every
  `SPLIT_AT_GAP_BP` indel into one feature per gap-free run, CIGAR dropped after
  the clip;
- (b) optionally, direct records for a mate pair;
- (c) a `CoreGetInfo` header with `hasCoarseTier`, optionally `anchorAssemblyName`
  and `lanes[{name,label,group}]` (`starAnchorOf`, `declaredLanesOf`).

Provider quirks:

- `MCScanBlocksAdapter` is the only adapter implementing `mateShape: 'grouped'`.
- `MultiPairwiseSyntenyAdapter` ids are re-keyed `${childIndex}-...`; it declares
  `headerLanes`, so a window reads only the children asked (`childrenForLanes`,
  `refNameMapKey`). PIF adapters ignore `mateShape: 'grouped'`, so the display
  groups on the clipped `syntenyId`. A mate-vs-mate query returns the empty
  answer, not an error ([SYNTENY_LOD.md](SYNTENY_LOD.md)).
- `MultiGenomePAFAdapter` raises `noSuchPairError` for an unstated pair, which the
  lane-links fetch stamps empty; the indexed one cannot tell an unstated pair from
  an empty window and answers empty.
- `GbzBaseSyntenyAdapter` (graph plugin) is anchor-only, answers
  `lanePairsOnAnchor` from the graph's own alignment (`Subgraph.pairAlignments`,
  which gbz-base keeps in its CLI), has `hasCoarseTier: false` and no `identity`,
  and passes the lane selection to gbz-base as `keep` (`keepPredicate`).

## The two named tutorials

**`ecoli_orthologs_synteny`** is a gene-symbol join written as an MCScan
`.blocks` table. Group keys are gene symbols, so one anchor gene chains through
every lane, `bridgeSkippedLanes` carries a group past a lane that lacks it, and
`{ field: 'cluster' }` paints a conserved gene one colour down the stack. Past
about 500 kb bridged ribbons sweep the track ([DEMO_DATASETS.md](DEMO_DATASETS.md)).
`MW/laneStack.test.ts` pins that every checked-in demo sizes its track to the
whole stack. Order is density, not phylogeny; a tree order is designed, not built
([../ideas/waiting-on-a-call/ordering-synteny-lanes-by-similarity.md](../ideas/waiting-on-a-call/ordering-synteny-lanes-by-similarity.md)).

**`hg38_vertebrates_synteny`** is a `MultiPairwiseSyntenyAdapter` over UCSC liftOver
chains converted to PIF. A chain is one whole-chromosome record, so a small window
places each lane with one record whose CIGAR carries thousands of gaps. Before the
gap split the display drew it as one parallelogram, and the straightness read as
conservation while it was blindness to the CIGAR. The `identity` colour mode
cannot rescue a composed link, which carries no `identity` (`ribbonColor`). Only
the anchor-to-first-mate gutter comes from group placements; below it the ribbons
are composed links. The fine tier pulls the whole chain row per lane per window, so
the coarse tier is the byte lever
(`../measurements/pif-tier-wire-bytes.json`); the display cannot ask for coarse
on its own behalf.

A stacked LinearSyntenyView is N independent navigators tied by adjacent-pair
bands, so the one thing the lane stack does for free, pinning every genome to the
anchor's viewport, is what the stack cannot do. Use it for few rows with full
tracks each; use lanes for readability to about 50 with scrolling.

## Cost

N is the number of mate lanes drawn.

- **Fetches per settle**: one ortholog fetch; N child tabix reads inside a
  `MultiPairwise` star; every haplotype in the window inside GBZ regardless of N;
  N+1 lane-gene RPCs; N-1 lane-link RPCs. Lane-gene and lane-link fetches use
  per-lane staleness, the one sub-linear place in the display.
- **Main thread**: `decideLaneFrames` is O(N x G log G); `pairLinks` recomposes
  every pair on each fetch commit. `multiwayZoomCost.probe.ts` measures the cell
  packing.
- **Rendering**: about ten draw calls per lane whatever is on screen, and nothing
  culls layers scrolled out of the viewport. The pick does not draw
  (`pickRibbonAt`, `createSyntenyPicker`).
- **Session**: a lane draws genes only if the session holds its assembly
  (`holdsAssembly`) or a plugin describes it, so a cohort config without a
  describing plugin needs one assembly and annotation track per haplotype
  ([PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md)).
- **What breaks first**: for a gene table, the lane-gene fan-out and glyph cell
  rebuild; for a PIF star, fine-tier bytes, then draw calls; for GBZ, the fetch
  (every haplotype per window, `nodeLimit` refusing wide windows, no coarse tier),
  which lane selection does not reduce.

## Suitability for graph pangenomes

The display needs from a graph route: records per chosen haplotype (the GBZ
adapter hands `keep` to `Subgraph.keepHaplotypes`; the subgraph fetch itself only
shrinks with reference-anchored samples in the companion plus a per-path walk);
stable ids per (haplotype, contig, window); a header lane universe; an assembly
and annotation per lane in the session, or the lane is boxes; a coarse tier (the
GBZ route has none, so chromosome scale is the PIF's job); and identity (the
reader's records carry none, so the identity colour mode is dead on a GBZ lane).

**Row-per-haplotype is not the frame at cohort scale.** Three reasons, each
sufficient
([../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"HPRC at scale: lane selection"): a fixed pitch is no reading at hundreds of
lanes; every window fetches the whole cohort until the reader takes a set; and
"which haplotypes differ here" is a genotype question the alignment cannot answer
cheaply. The scaling story is two surfaces with a hand-off, not one surface that
grows.

**`launchFromGraph`** launches an LGV or `LinearSyntenyView` and never constructs a
MultiWay display; the cheap bridge is sending `GraphNode.samples` to
`setSelectedLanes` on the session's multiway track. **Sample rows**
(`sampleRowLayout.ts`) draw attribution, not carriage; drawing carriage is the
genotype matrix drawn as tubes, the reason not to build it there (ideas file,
§"The graph data path, and what Sample rows should draw").

**The reader's CIGARs.** The reader's `align()` and `gfa_to_pairwise_paf.py` emit
different CIGARs for the same walks by design (`50I50D` against `50X`), and
nothing measures them against each other. The difference decides clipped extents
where a record straddles the window edge.

## Lane stability

`multiwayLaneStability` walks a window across grape chr1 on the deployed
`demos/grape_peach_cacao`, reading every lane out of `decideLaneFrames` with the
previous decision carried in.

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

`crossed steps` counts steps where a lane is drawn with more than half its ribbon
pairs to the lane above crossing, so a rule that holds a lane the wrong way round
shows there however rarely it flips. The `fallback` columns are the anchor-order
sum alone, kept as the control.

The shipped vote weighs every pair of shared runs by the product of group weights,
against the lane above, or the anchor where the lane above shares fewer than three
groups. We measured and rejected three alternatives: the neighbour rule weighted
by the lighter run, the heaviest collinear chain each way, and voting against the
anchor throughout. None crosses less on any lane; the neighbour rule flipped less
only because it held lanes the wrong way round. The shipped rule costs
oscillations that cascade, since an upper lane's flip inverts the vote of lanes
below; voting against the anchor everywhere leaves lower lanes crossed for as long
as they are held, while an oscillation is one fold, so the lane-above vote stays.

**What the vote reaches on a pairwise source.** A pairwise record is a group with
one mate, so below the top lane a lane shares no group with the lane above and
votes against the anchor. `multiwayOrientation17p.probe.ts` reads the 17p figure's
window with no incumbent:

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
order. The strand columns do not decide a lane: block order and record strand part
ways wherever a region was rearranged.

**A broken hold re-aligns in one step.** Sliding only as far as restores coverage
fails: the least slide leaves a placement's centre on the frame edge, the next pan
pushes it out and the slide brings it back, so the lane pins to that placement and
stops panning with the anchor. A zoom is a scale about the pivot, so a rung change
re-aligns only when the rescaled frame no longer shows the content.

**`SyntenyFollow` shares only the launch.** A `RowFrame` is one linear ramp over
one refName and a followed row is a `displayedRegions` layout, so the shapes do
not unify; `interpolateFollowSpan` and `resolvePanel`'s CIGAR-less branch are one
clamp-to-block interpolation. `computeRowFrame` weighs a contig by anchor bp, as
`resolvePanel` does; `frameSpan` clips rather than tests, because
`followWindowMapping` refuses to extrapolate past its outermost block; and
`axisSpan`, on core's `clipToDisplayedRegions`, keeps an interval straddling a
displayed-region edge, which `bpToPx` drops whole.

**What not to reopen**: the lane decision and its hysteresis; the cell/layer
renderer and its parity tests; gene glyph parity with the canvas track; per-lane
staleness on the dependent fetches; the lane picker at its current scale; and the
E. coli and primate demos as they stand.
