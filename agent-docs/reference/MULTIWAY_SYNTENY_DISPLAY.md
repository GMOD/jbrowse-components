---
name: multiway-synteny-display
description: What are MultiWaySyntenyDisplay's settled invariants, adapter contract and cost model, and where does the lane frame stop for graph pangenomes? Read before changing its placement, ordering, LOD gating or launch route.
kind: spec
---

# MultiWaySyntenyDisplay: invariants, contract, ceiling

MultiWaySyntenyDisplay is a per-window, anchor-star, one-frame-per-genome lane
stack inside an ordinary LinearGenomeView. A frame is affine between the holes it
opens at the lane's deletions. Unbuilt and undecided work lives
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
  gutter draws the ops of the record it places.
- **A gutter draws only what its source states** (`rowsVsAnchor`). A source
  whose header names an anchor and answers no lane pairs holds each lane against
  the anchor alone, so every gutter draws its lower lane against the anchor: the
  top edge is the anchor's axis, marked by a ticked rule under the lane above
  (`anchorRuleY`), and each lane label opens with a `vs <anchor>` badge. A source
  answering lane pairs draws neighbour against neighbour, and a pair it has not
  answered draws nothing.
- **A lane opens a hole at each deletion it carries against the anchor**
  (`laneOpeningsOf`, `LaneOpening`): where two alignment pieces of the lane abut,
  or nearly, while their anchor ends sit `SPLIT_AT_GAP_BP` or more further apart.
  The frame's `min`/`max` are in the opened coordinate (lane bp plus every hole
  before it), so what follows the hole sits under its own anchor stretch and every
  carrier of one deletion draws the same gap, whoever its neighbour is. Before
  this, rows were the lane's bp end to end: HPRC's CFHR3–CFHR1 carriers showed
  27 kb of sequence then blank, and only the carrier under a non-carrier drew the
  deletion, as one slanted ribbon. Holes come off every fetched group
  (`model.laneOpenings`), not the viewport's, so one opens when both its pieces
  arrive; the decision's `pivotLaneBp` stays lane bp, so a hole appearing
  elsewhere moves only what lies beyond it. A lane-pair ribbon crossing a hole is
  cut there (`addAcrossHoles`), and so are a gene's exons, intron lines and hit
  boxes (`Lane.spansOf`, `frameSpans`). Gene records never open: their spacing
  is no deletion. An insertion opens nothing; its sequence draws as before.
- **A lane draws no mark for sequence the anchor lacks.** The ribbon over an
  insertion fans open. A purple bar on every carrier lane plus a purple tint on
  the ribbon between carriers was tried and removed.
- **A gene-table row the anchor lacks draws between the lanes that carry it**
  (`anchorlessGroupsOf`, `PlacedGroup` with no `anchor`). Each mate lane reads
  the table on its own window (`laneGroupsFetchSpecs`); the lanes place and
  bridge those rows like any group, and the frames, the vote and the holes read
  only anchored groups. The display reads every row placed in any drawn lane's
  window: the anchor is one lane among them for the data and the frame
  reference for the geometry, which is what an alignment source's lane-pair
  fetch already did. It is the default with no slot; no captured figure read
  worse for it. Rows sharing a placement merge into one group keyed by its
  lowest placement, since a table folds a lane query's rows by that lane's gene
  (a paralog pair reads as two rows from one lane and one from the other) and
  per-genome gene IDs differ, so no name can key it. Each placement's
  orientation is its gene's own strand. A star source indexes its anchor alone
  and gets no such fetch.
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
- **A nameless record's group key is its id**, so a source answering per window
  must mint the same id for the same run on every refetch, or the clicked outline
  and hover re-resolve to another group (`clipToRegion`'s region suffix is the
  pattern).
- **A flip pin and contig pin outrank the vote** (`pinnedLaneFlips`,
  `pinnedLaneContigs`); a released pin leaves no incumbent. The decision is stored
  as data and the drawn frame derives from it against the live view on every pan
  (`frameFromDecision`, `rowFrames`).

## Where things live

- **Lane links**: `laneLinksFetchSpecs`; `lanePairsOnAnchor` adapters are asked for
  each adjacent pair on the anchor's merged blocks, and `lanePairBatches` ones
  for all of them in one call. Only pairs whose gutter is within a screen of the
  scrolled window are asked for (`gutterNearViewport`): on the HPRC graph each
  pair cut alone costs 70-660 ms of worker time, so 463 lanes took minutes.
- **Composing a lane pair through the anchor** was built (`composeLaneLinks`,
  `composeAlignmentOps`) and removed. It drew a neighbour comparison the source
  never states, with a tooltip as its only disclosure: a reversed lane coloured
  both gutters touching it, and sequence two lanes share and the anchor lacks
  drew as a break between them. Through GRCh38 it also loses the loci picked for
  being absent from it, which is why a graph adapter's lane pair is the
  alignment `pairAlignments` reads off the graph:

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

**A broken hold re-aligns in one step.** Sliding only as far as restores coverage
fails: the least slide leaves a placement's centre on the frame edge, the next pan
pushes it out and the slide brings it back, so the lane pins to that placement and
stops panning with the anchor. A zoom is a scale about the pivot, so a rung change
re-aligns only when the rescaled frame no longer shows the content.

**What not to reopen**: the lane decision and its hysteresis; the cell/layer
renderer and its parity tests; gene glyph parity with the canvas track; per-lane
staleness on the dependent fetches; the lane picker at its current scale; and the
E. coli and primate demos as they stand.
