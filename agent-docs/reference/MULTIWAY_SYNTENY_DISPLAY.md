---
name: multiway-synteny-display
description: What are MultiWaySyntenyDisplay's settled invariants, adapter contract and cost model, and where does the lane frame stop for graph pangenomes? Read before changing its placement, ordering, LOD gating or launch route.
kind: spec
---

# MultiWaySyntenyDisplay: invariants, contract, ceiling

MultiWaySyntenyDisplay is a per-window, anchor-star, one-frame-per-genome lane
stack inside an ordinary LinearGenomeView. A frame is affine between the holes it
opens at the lane's deletions. Unbuilt and undecided work lives in
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
  gutter draws the ops of the record it places.
- **A gutter draws only what its source states** (`rowsVsAnchor`). A source
  whose header names an anchor and answers no lane pairs holds each lane against
  the anchor alone, so every gutter draws its lower lane against the anchor: the
  top edge is the anchor's axis, marked by a ticked rule under the lane above
  (`anchorRuleY`), and each lane label opens with a `vs <anchor>` badge. A source
  answering lane pairs draws neighbour against neighbour, and a pair it has not
  answered draws nothing.
- **A lane opens a hole at each deletion it carries against the anchor**
  (`laneOpeningsOf`, `LaneOpening`): where two pieces abut in the lane, or
  nearly, while their anchor ends sit `SPLIT_AT_GAP_BP` or more further apart,
  and either they are one alignment record (`recordId`, stamped by
  `clipFeatureToRegion`) or the lane places the anchor between them nowhere.
  Two records meeting where that stretch went elsewhere in the lane are a
  rearrangement's breakpoint and open nothing, which keeps the lane's rung
  independent of how far the fetch reached past the viewport. The record alone is
  not the test: `hprc_multiway_gfa.pif.gz` writes the CFHR3–CFHR1 deletion as two
  abutting records. The frame's `min`/`max` are in the opened coordinate (lane bp
  plus every hole before it), so what follows the hole sits under its own anchor
  stretch and every carrier of one deletion draws the same gap. Holes come off
  every fetched group (`model.laneOpenings`), not the viewport's, so one opens
  when both its pieces arrive; the decision's `pivotLaneBp` stays lane bp, so a
  hole appearing elsewhere moves only what lies beyond it. A lane-pair ribbon
  crossing a hole is cut there (`addAcrossHoles`), and so are a gene's exons,
  intron lines and hit boxes (`Lane.spansOf`, `frameSpans`); its label goes on the
  widest piece. Gene records never open: their spacing is no deletion. An
  insertion opens nothing; its sequence draws as before.
- **Two lanes join a group's placements only where one source row states the
  pair** (`statedTogether`, `MultiWayPlacement.row`). A table folding its rows by
  anchor gene hands over one group with several placements per lane, and without
  the row every placement would join every placement of the next lane. A source
  keeping no rows still joins them all.
- **A lane draws no mark for sequence the anchor lacks.** The ribbon over an
  insertion fans open. Per-carrier bars and a tint on the ribbon between carriers
  were tried and removed.
- **A gene-table row the anchor lacks draws between the lanes that carry it**
  (`anchorlessGroupsOf`, `PlacedGroup` with no `anchor`). Each mate lane reads the
  table on its own window (`laneGroupsFetchSpecs`); the lanes place and bridge
  those rows like any group, and the frames, the vote and the holes read only
  anchored groups. The anchor is one lane among them for the data and the frame
  reference for the geometry. It is the default with no slot. Rows sharing a
  placement merge into one group keyed by its lowest placement, since a table
  folds a lane query's rows by that lane's gene and per-genome gene IDs differ, so
  no name can key it. Each placement's orientation is its gene's own strand. A
  star source indexes its anchor alone and gets no such fetch.
- **A lane gene draws its representative transcript**, the one the feature
  track's `representative` draws (`representativeIsoform`), ranked by the
  transcript types and canonical tags the gene track's own feature display reads
  (`laneIsoformSettings`). A union of every isoform's exons is no molecule
  (`geneGlyphMode.ts`). The lane places introns, the arrow, the label and the
  placement claim on that transcript's extent, and draws nothing for a childless
  transcript beside it.
- **Strand means the record's strand**, never the drawn twist, in the config
  schema, its help text and `multiwayGeometry.ts`. A mate's `orientation` is the
  pair's strand, never the mate's transcription strand.
- **Lanes sort by their heaviest contig's group weight** (`rowAssembliesOf`), not
  placement count, which rewards a haplotype whose alignment breaks. Ties break on
  first-seen order, so `ComparativeAdapterBase` emits per-region streams in region
  order and `MultiGenomeIndexedPAFAdapter` sorts reads by `fileOffset`, and tied
  lanes do not reorder with network arrival.
- **Haplotype lanes read off a graph stack by structure** where nothing pins the
  order (`holdLaneOrder`, `structureOrder`; sources with `lanePairsOnAnchor`). A
  ribbon joins neighbours only, and densest-first puts two different structures in
  nearly every pair. The order is worked out when the anchor fetch lands and held
  until a fetch leaves that window or the lane selection changes, so a pan never
  reshuffles the stack. Lanes `rows.sort` pins lead and the rest keep that order.
  Cross-species stacks keep densest-first.
- **A star launch seeds from the display's lanes** (`lanePanelsForRegion`) and
  offers **Repeat ⟨anchor⟩ between panels** so every band is a direct pair. A
  stacked view has no notion of "every level anchored on the hub", and mate-vs-mate
  returns nothing from `MultiPairwiseSyntenyAdapter`.
- **The alignment shift is unclamped** (`alignFrameTo`): a frame may start below
  zero while the header, ticks and gene fetch stop there. The anchor seed
  `anchorAbsX` is the centre of what the viewport shows of each group, not of the
  whole record, which slides long-record lanes toward their overhang.
- **The alignment median weighs as the contig vote does** (`voteEvidence`): one
  per gene on a gene table, bp on an alignment. Weighed by bp, one long gene
  decided a gene-table lane, so a BED's gene span (UTR isoforms) or one long
  neighbor slid the HOX lanes off their cluster.
- **A gutter stacks its ribbons' alpha**, as the pairwise band does. A
  strongest-ribbon `min` blend was removed: it flattened overlap shading.
- **Nothing hands an adapter its sequence**: no RPC passes one, and renaming keeps
  none a caller passes. The display holds a lane's assembly as a temporary one
  (`installLaneAssemblies`) so `loadRefNameMap`'s `CoreGetContigs` primes the
  adapter with the genome's sequence. Per-lane gene adapters written into the star
  config were declined.
- **Never call `assemblyManager.get` for a lane the session lacks.** It fires
  `Core-handleUnrecognizedAssembly` per lane and makes the Hubs plugin connect each
  genome's whole config. The display puts them to `Core-describeAssemblies` in one
  batch (`lanesToDescribe`). Temporary assemblies return through the session
  captured at attach, since a display is destroyed after its view detaches; "Open
  in new view" returns one first. A GenArk-backed db draws only through the
  aliases (jb2hubs' `defaultGeneTrackId` spelling).
- **An `{assembly}` entry in `laneGeneTracks` or `laneLayers[].tracks` is filled
  per lane** with the lane's canonical name, then its aliases, and only a held
  assembly's aliases are read (`namedLaneTracks`). Plain ids come before
  patterns, each in entry order. A locstring's braces mean something else:
  `{hg38}chr1:1-100` names an assembly literally.
- **A lane template reads a lane only while each region is under
  `LANE_TEMPLATE_MAX_BP`**, since the region is the sequence it downloads. An
  adapter type that computes from no sequence is no template (every lane would read
  one file at its own coordinates).
- **A nameless record's group key is its id**, so a source answering per window
  must mint the same id for the same run on every refetch, or the clicked outline
  and hover re-resolve to another group (`clipToRegion`'s region suffix is the
  pattern).
- **A flip pin and a lane pin outrank the vote** (`lanePins`, a list of
  records: `{ lane, refName, at? }` for a contig or a block on it,
  `{ lane, refName, flipped, anchor }` for the orientation on that contig);
  a released pin leaves no incumbent. `lanePins` is a session property, as
  `hiddenLaneNames` is, so a share link opens on them, and `multiwayTables`
  takes both in the same shape (`pins`, `hidden`). The decision is stored as
  data and the drawn frame derives from it against the live view on every pan
  (`frameFromDecision`, `rowFrames`).
- **The display and `multiwayTables` share one lane pipeline**: `laneRowsOf`
  picks and orders the lanes, `pinsInForceOf` resolves the pins, and an
  `AnchorStage` (`laneStage.ts`) runs the decisions, frames and stack against
  the view or a static layout. The model calls them from separate getters,
  deciding at the settled view in an autorun and laying out frames and the
  stack at the live one. A table keeps sub-px placements (`wholePx: false`),
  where the view places at whole px.
- **Lanes decide at the settled view, and draw at the live one.** The decision
  reads the coarse blocks and the zoom and offset they were laid out at
  (`coarseBpPerPx`, `coarseOffsetPx`), so a zoom animation re-decides nothing:
  tracking the live zoom costs a whole `decideLaneFrames` per frame. The offset
  picks the viewport the pivot and the hold test are judged in. The stack is laid
  out against `renderOriginPx` and clips to a screen either side of it
  (`stackReach`), so a reaction lays it out again once the view has moved more
  than a screen away between settles, and decides nothing.

## Where things live

- **Lane names**: `rows.labels` names a lane by any spelling of its assembly
  (`rowLabels`); a lane it leaves out shows its assembly's display name, or the
  label a source's header declares (`laneLabel`).
- **The color key** floats in the gutter under the anchor lane (`legendTop`),
  since at the top corner it hid the anchor's genes. Where that gutter is shorter
  than the key it covers the second lane's changes chip instead; its close button
  clears either.
- **Lane changes chip**: the header lists what the records state across the gaps
  the shown frame meets, largest first, two then a count, in the HPRC portal's
  words (`laneIndelsOf`'s `changes`, `laneHeaderRows`). Across each gap between
  two consecutive pieces of a lane contig cut in one fetch window (`clipWindow`;
  between two windows lies anchor the fetch never read), the anchor gap and the
  lane gap each list at their own size once they reach `SPLIT_AT_GAP_BP`, within
  one record, or across two where the lane places the anchor stretch nowhere. A
  935 kb stretch replaced by 900 kb reads "935 kb deletion, 900 kb insertion". The
  hole opens at the net of the two, so what follows sits under its own anchor
  stretch. Netting the chip into one deletion or one shift infers an allele
  ([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)).
- **The chip names an inversion** by its anchor span where a run of the other
  strand sits between two runs, inside their outer anchor ends and mostly outside
  what they cover (`laneInversionsOf`). Paralog hits in flanking segdups make the
  flanks' inner ends land out of anchor order, so the test reads the outer ends. A
  reverse hit elsewhere on the anchor, or an inverted copy of a flank, is no
  inversion, and the vote's `[rev]` plays no part.
- **A lane draws an inversion as its records state it**: the ribbons cross, and
  the default ribbon color (strand) paints them blue. Mirroring the inverted run
  in place was tried and reverted: it drew the lane's sequence in an order its
  assembly does not have.
- **A lane inside a deletion longer than the window**: with `splitAtGapBp`,
  `clipFeatureToRegion` answers a record whose gap between two runs holds the
  whole window with that gap alone, marked `spansWindow`, and `multiWayFeaturesOf`
  lifts it off into `deletions` before anything groups, frames or draws it. A lane
  the window shows nothing else of becomes a row at the foot of the stack, headed
  "no step on the reference across <bp>". A deletion two records state is out of
  reach, since neither record meets the window.
- **A chosen lane the window places nothing in** (`unalignedChosenLanes`): a lane
  `rows.kept` names joins the same foot rows, headed "no alignment in this
  window", once the held fetch has landed and asked for it (`answeredLaneTest`,
  the gate the picker's `placed: false` reads). An unconstrained stack, or
  `configuredLanes` alone, adds no row. A pan keeps the held answer until the next
  fetch lands, as every other lane does.
- **Graph and PIF lanes read alike.** The graph plugin stamps one `recordId` on
  every run of a walk record, and `hprc_multiway_gfa.pif.gz` writes an insertion
  as a gap between two records; both read the same chip.
- **Lane links**: `laneLinksFetchSpecs`; `lanePairsOnAnchor` adapters are asked for
  each adjacent pair on the anchor's merged blocks, and `lanePairBatches` ones for
  all of them in one call. Only pairs whose gutter is within a screen of the
  scrolled window are asked for (`gutterNearViewport`), since a graph pair costs a
  walk per lane.
- **Composing a lane pair through the anchor** was built and removed. It drew a
  neighbour comparison the source never states, with a tooltip as its only
  disclosure: a reversed lane colored both gutters touching it, and sequence two
  lanes share and the anchor lacks drew as a break between them. Through GRCh38 it
  also loses the loci picked for being absent from it, which is why a graph
  adapter's lane pair is the alignment `pairAlignments` (graph plugin) reads off
  the graph:

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

## Suitability for graph pangenomes

**Row-per-haplotype is not the frame at cohort scale.** Three reasons, each
sufficient
([../ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"HPRC at scale: lane selection"): a fixed pitch is no reading at hundreds of
lanes; every window fetches the whole cohort until the reader takes a set; and
"which haplotypes differ here" is a genotype question the alignment cannot answer
cheaply. The scaling story is two surfaces with a hand-off, not one surface that
grows.

**Tens of lanes do read, chosen by genotype and stacked by structure.** The HPRC
portal's Haplotypes launch is that hand-off at one locus. It shares 32 lanes over
the forms the structural-state sidecar groups haplotypes into, by how many carry
each, and the display stacks graph haplotype lanes by structure, so each form
draws as a block of straight ribbons as tall as its share. At 22 px a lane has no
room for gene names; the launch draws 40 px lanes to keep them.

## Lane fit

A lane draws one block of its contig at a time. `blocksOf` clusters the
placements a quarter window apart, sets aside the strays (a cluster under 5% of
the lane's vote evidence, or half that for a cluster the lane already draws), and
links the rest across lane gaps of up to a window, or wider where the two still fit
1.5x together. The heaviest block draws, the one held keeps its place until
another outweighs it by the switch margin, and every other block holding a fifth
of the drawn one's evidence is named in the header, `· also at <locus>`, with a
menu item that pins it. The rung rounds up the drawn block's extent, which is also
`fitMin`/`fitMax`, so the lane fetch and a launched panel read what the lane
draws. A placement off the frame draws no ribbon (`groupRunsOnRow` keeps what
meets the frame).

Fitting every block and zooming out was declined for the fanned ribbons it draws.
Judging pieces by their centres, a densest-window fit and peeling end clusters
within a budget were each measured and replaced by blocks. A block gap of 1.5
windows was measured and drew more wide steps.
`multiwayLaneFit.probe.ts` walks the 17p duplication region:

<!-- BEGIN GENERATED MEASUREMENT multiway-lane-fit -->

_Generated by `pnpm autogen` — edit the source, not this block._

| lane     | mean rung | rung chg | rung osc | wide steps | undrawn |
| -------- | --------: | -------: | -------: | ---------: | ------: |
| panTro6  |     1.20x |        8 |        0 |          7 |   12.1% |
| gorGor6  |     1.17x |        7 |        1 |          0 |    4.7% |
| ponAbe3  |     1.26x |       11 |        1 |          1 |    5.2% |
| rheMac10 |     1.41x |       11 |        0 |         12 |     11% |
| calJac4  |     1.23x |       13 |        2 |          0 |   24.5% |
| mm39     |     1.31x |       11 |        0 |          6 |    9.2% |
| canFam6  |     1.05x |        8 |        3 |          0 |      7% |
| bosTau9  |     1.26x |        9 |        1 |         15 |    8.8% |


<!-- END GENERATED MEASUREMENT multiway-lane-fit -->

## Lane stability

`multiwayLaneStability` walks a window across grape chr1 on the deployed
`demos/grape_peach_cacao`, reading every lane out of `decideLaneFrames` with the
previous decision carried in.

<!-- BEGIN GENERATED MEASUREMENT multiway-lane-stability -->

_Generated by `pnpm autogen` — edit the source, not this block._

| lane        | contigs seen | contig chg | contig osc | drawn flip chg | drawn flip osc | fallback flip chg | fallback flip osc | empty steps | crossed steps | rung chg | rung osc | slip steps | median slip px | max slip px |
| ----------- | -----------: | ---------: | ---------: | -------------: | -------------: | ----------------: | ----------------: | ----------: | ------------: | -------: | -------: | ---------: | -------------: | ----------: |
| peach       |            2 |          3 |          0 |              5 |              0 |                 8 |                 1 |          33 |             7 |        6 |        0 |         19 |            330 |       4,645 |
| cacao       |            2 |          4 |          0 |             10 |              1 |                17 |                 3 |          33 |            28 |       16 |        1 |         16 |            238 |       2,003 |
| citrus      |            3 |          8 |          0 |              9 |              2 |                13 |                 3 |          33 |            11 |        2 |        0 |         19 |            205 |         672 |
| poplar      |            5 |          8 |          0 |              9 |              2 |                10 |                 1 |          33 |             5 |        4 |        0 |         23 |            284 |       7,156 |
| tomato      |            4 |          8 |          0 |              8 |              1 |                11 |                 2 |          33 |            34 |        6 |        0 |         13 |            306 |       3,014 |
| arabidopsis |            4 |          8 |          0 |              8 |              0 |                16 |                 7 |          34 |            35 |        2 |        0 |         25 |            214 |      12,441 |


<!-- END GENERATED MEASUREMENT multiway-lane-stability -->

The shipped vote weighs every pair of shared runs by the product of group weights,
against the lane above, or the anchor where the lane above shares fewer than three
groups. Three alternatives were measured and rejected: the neighbour rule weighted
by the lighter run, the heaviest collinear chain each way, and voting against the
anchor throughout. None crosses less on any lane. The shipped rule costs
oscillations that cascade, since an upper lane's flip inverts the vote of lanes
below; voting against the anchor everywhere leaves lower lanes crossed for as long
as they are held, while an oscillation is one fold.

**What the vote reaches on a pairwise source.** A pairwise record is a group with
one mate, so below the top lane a lane shares no group with the lane above and
votes against the anchor. `multiwayOrientation17p.probe.ts` reads the 17p figure's
window with no incumbent:

<!-- BEGIN GENERATED MEASUREMENT multiway-17p-orientation -->

_Generated by `pnpm autogen` — edit the source, not this block._

| lane     | contig | drawn   | fallback | votes against | shared groups | all-pairs bwd | neighbour bwd |      + bp |      - bp | majority |
| -------- | ------ | ------- | -------- | ------------- | ------------: | ------------: | ------------: | --------: | --------: | -------- |
| panTro6  | chr17  | [rev]   | [rev]    | lane above    |             4 |         1.000 |         0.971 |    27,123 | 1,168,258 | - 0.977  |
| calJac4  | chr5   | [rev]   | [rev]    | anchor        |            24 |         1.000 |         0.950 |   582,085 |   597,199 | - 0.506  |
| rheMac10 | chr16  | forward | forward  | anchor        |            12 |         0.075 |         0.270 |   583,055 |   593,900 | - 0.505  |
| ponAbe3  | chr17  | forward | forward  | anchor        |             4 |         0.000 |         0.000 | 1,147,002 |    22,332 | + 0.981  |
| canFam6  | chr5   | forward | [rev]    | anchor        |            10 |         0.100 |         0.798 |   527,509 |   576,664 | - 0.522  |
| bosTau9  | chr19  | forward | [rev]    | anchor        |            11 |         0.153 |         0.340 |   480,205 |   523,228 | - 0.521  |
| mm39     | chr11  | [rev]   | forward  | anchor        |            17 |         0.827 |         0.608 |   440,288 |   487,063 | - 0.525  |
| gorGor6  | chr5   | [rev]   | [rev]    | anchor        |             1 |      abstains |      abstains |         0 |   644,668 | - 1.000  |


<!-- END GENERATED MEASUREMENT multiway-17p-orientation -->

**A broken hold re-aligns in one step.** Sliding only as far as restores coverage
fails: the least slide leaves a placement's centre on the frame edge, the next pan
pushes it out and the slide brings it back, so the lane pins to that placement and
stops panning with the anchor. A zoom is a scale about the pivot, so a rung change
re-aligns only when the rescaled frame no longer shows the content.

**What not to reopen**: the orientation vote, the contig choice and the hysteresis
on each; the cell/layer renderer and its parity tests; gene glyph parity with the
feature track; per-lane staleness on the dependent fetches; the lane picker at its
current scale; and the E. coli and primate demos as they stand.
