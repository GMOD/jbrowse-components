---
name: multiway-synteny-analysis-2026-09-06
description: A verified 2026-09-06 reading of MultiWaySyntenyDisplay against its code and hosted data — what the lane stack is, how the tutorials use it, where it is incorrect, its cost per lane, and a ranked list of fixes with the graph route's tie-ins. A block at the top says which findings have since landed (affine placement, strand semantics, densest-first, the LOD gate) so they are not re-fixed, and 4.10 and 4.11 are what a 2026-09-07 re-read added: what the lane sort's exact-tie/file-order behaviour really is (and which two figures are stale against a data rebuild rather than nondeterministic), and an uncapped alsoOn that overflowed an exported figure, since fixed. Read before changing the display's placement, ordering, LOD gating or launch route.
---

# MultiWaySyntenyDisplay: suitability and scalability

Read against the code on 2026-09-06. Paths: `JC/` is `~/src/jbrowse-components`,
`P/` is `~/src/jb2plugins/jbrowse-plugin-graphgenomeviewer`, `G/` is
`~/src/gbz-base-js`. The display is
`JC/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/`, abbreviated
`MW/` below. Every measurement in this document was either taken today
against the hosted data or is cited to the file that records it.

## What has landed since (2026-09-07)

Re-checked against the code and every tutorial the display appears in. These
are FIXED — do not re-fix them:

- **4.1**, alignment records drawn as affine blocks. `SPLIT_AT_GAP_BP = 10_000`
  (`MW/afterAttach.ts:44`) rides both the anchor fetch and the pair fetch and is
  honoured through `clipFeatureToRegion`, so a record is cut at every large
  indel and the hg38 page documents the cut rather than the artefact.
- **4.2**, the two strand semantics. `configSchema.ts`, the `Color ribbons by`
  help text and `multiwayGeometry.ts` now all say the record's strand and not
  the drawn twist; the four tutorials that stated the crossing were corrected
  on 2026-09-07.
- **4.3**, densest-first rewarding fragmentation. `rowAssembliesOf` weights by
  `placements.length * group.weight`.
- **2.2**, the LOD menu on a source with no coarse tier. The gate withdraws the
  entry off the header, pinned by `lodMenuGate.test.ts`.
- **4.8** in part: the grape page's "no GFF3", the HPRC page's Lanes submenu and
  the figure-manifest gap are all closed. `user_guide.md` still has no multiway
  section, and `GbzBaseSyntenyAdapter` still has no config page (it is
  out-of-repo, and nothing the pangenome pages document about it is wrong).

Still open and re-confirmed: **4.4** (the star launch), **4.5** (the pair
fetch's tier and window), **4.7** (the serialisation boundary no test names),
**4.9** (what the tests do not pin).

The pass added 4.10 and 4.11 below. 4.10 replaces a wrong causal claim from
its first draft: the lane sort is deterministic, and the figures that
disagreed were shot against two different datasets.

## The verdict in one paragraph

MultiWaySyntenyDisplay is a per-window, anchor-star, one-affine-frame-per-genome
lane stack that lives inside an ordinary LinearGenomeView. Its data model is one
ortholog/alignment fetch on the anchor, a group per anchor feature with one
placement list per mate assembly, and one lane per mate assembly drawn in a
frame `{contig, flipped, rung × anchor span, pivot}` decided once per settle.
That model is exactly right for what the two named tutorials use it for: a gene
table over 44 bacterial genomes and a star of eight pairwise alignments over
one human locus. It is the wrong frame, unmodified, for three things the
question asks about: more than one row of content per genome (a lane is a
display-internal object that hosts one annotation and nothing else), alignment
sources whose within-record structure matters (the display never reads a
CIGAR, and at TP53 that turns a 25 kb mouse indel into a straight ribbon), and
cohorts of hundreds to thousands of haplotypes (every cost is linear in lanes,
the picker is a flat checkbox list, and the graph fetch is the whole cohort
regardless of the selection). The row-per-haplotype picture should be kept as
the *reading* for a chosen handful; the *choosing* and the *fetching* need a
different surface and a different data path, and both are already sketched in
the plugin's vision documents.

## 1. What the display actually is

### 1.1 The data model

**One fetch, no lane filter.** `fetchPhases` in `MW/afterAttach.ts:38-60`
issues one `CoreGetFeatures` over the anchor's merged static blocks with
`opts: { mateShape: 'grouped', lodMode: lodTier, clipToRegion: true }` and no
`targetAssemblyName`, so the adapter answers with every pair anchored on the
queried assembly. `selectedLanes`, `hiddenLanes` and the config `lanes` slot
never reach the fetch; they filter `rowAssemblies` locally
(`MW/model.ts:734-756`). The design record says this is deliberate
(`JC/agent-docs/ideas/multiway-synteny-lgv-track.md:97-104`; `P/agent-docs/GBZ_PLAN.md:297-301`)
because a graph adapter has to identify every walk before it knows whose it
is.

**Groups.** `groupFeatures` (`MW/layoutMultiWay.ts:140-181`) folds features into
`MultiWayGroup { key, anchor, mates: Map<assembly, MatePlacement[]>, feature, weight }`.
The key is `name`, else `syntenyId`, else `feature.id()` (`:127-134`), so a
named table (MCScan blocks, gene-symbol join) chains a gene across every lane,
while an alignment source makes every clipped record its own group. A mate's
`orientation` is the *pair's* strand (`:58-70`), never the mate object's strand.
`weight` is anchor bp for a nameless record and one per gene for a named one
(`:72-85`; `voteEvidence`).

**Lanes.** `rowAssembliesOf` (`:200-232`) orders mate assemblies by placement
count over the whole fetched block set, then pins `rowOrder`; `rowAssemblies`
(`MW/model.ts:734-756`) drops the anchor, `hiddenLanes`, and anything outside
`laneSelection` (`selectedLanes ?? config.lanes`, `:663-671`). `laneUniverse`
(`:687-720`) is the adapter header's declared `lanes` followed by anything the
window placed that the header did not name. The header is read only when the
adapter tiers or declares `adapterCapabilities: ['headerLanes']`
(`:647-657`; `MW/afterAttach.ts:264-272`).

**Frames.** `decideLaneFrames` (`MW/laneDecision.ts:470-597`) walks the lanes
top down once per settled block set: contig by `preferIncumbent` with a 1.5×
switch margin (`JC/plugins/linear-comparative-view/src/syntenyHysteresis.ts:10-25`),
extent by `keepNearMedian` (`OUTLIER_REACH = 1.5` window spans), rung off
`SCALE_LADDER = [1, 1.5, 2, 3, 5, 8, 12, 20, 40, 80]` with an 0.85 shrink room
(`:52-86`), orientation by a 0.9 deadband over ≥5 shared groups against the
lane *above* (`:298-347`), offset by the weighted-median displacement to the lane
above clamped to the rung's slack (`:351-373`), and a placement hold while the
frame still shows 90% of the placed weight (`:73`, `:520-548`). The decision is
`{refName, flipped, rung, pivotAnchor, pivotLaneBp, fitMin, fitMax, alsoOn, pinned}`
and the drawn frame is derived from it against the live view on every pan
(`frameFromDecision`, `:400-422`; `MW/model.ts:1034-1057`). This machinery is
measured (the stability table in the design record, lines 469-495) and is the
best-engineered part of the display; nothing below recommends touching it.

**Lane genes.** `laneGeneAdapters` (`MW/model.ts:908-950`) walks every session
track (connections included) and keeps, per lane, the best-ranked single-assembly
annotation track by adapter type (`MW/laneAnnotation.ts`). One `CoreGetFeatures`
per lane over `laneFetchRegion(frame)`, a power-of-two grid off the rung span
(`MW/layoutMultiWay.ts:386-414`), issued concurrently with per-lane staleness so
a pan re-asks only the lanes whose grid cell moved (`MW/afterAttach.ts:113-200`,
`:274-292`). Only lanes the session holds an assembly for get one
(`MW/model.ts:1026-1036`).

**Lane links.** For a source whose features carry no `name` and whose header
names no `anchorAssemblyName`, one `CoreGetFeatures` per *adjacent* lane pair
with `targetAssemblyName: lower` (`MW/model.ts:1053-1090`;
`MW/afterAttach.ts:294-311`). For a star (header names its anchor, or the pair
fetch came back empty) the pair's links are composed through the anchor by
`composeLaneLinks` (`MW/model.ts:1128-1175`; `MW/composeLaneLinks.ts:75-137`),
which linearly interpolates each record between its clipped ends
(`:37-52`).

**Rendering.** Cells keyed by identity: `bands`, `ribbons:<row>` per gutter plus
`ribbons:<row>><toRow>` per bridge, `ticks:<row>`, `glyphs:<row>` and
`boxes:<row>` per lane (`MW/multiwayGeometry.ts:34-46`, `:177-312`;
`MW/model.ts:1300-1330`). Ribbons ride the pairwise synteny GPU passes, lanes the
feature track's glyph passes (`MW/GpuMultiWayRenderer.ts:35-38`); Canvas2D and
SVG walk the same cells. A pan is one translate (`dragOffsetPx`,
`MW/model.ts:974-981`); the DOM is 22 nodes at 7 lanes (design record 540-545).

**LOD.** `lodTier` resolves on the main thread off the settled zoom and the
track's `coarseBpPerPxThreshold` (`MW/model.ts:246-270`;
`JC/packages/synteny-core/src/lodTier.ts:109-131`) and is folded into
`viewSignature`. The display itself reads no alignment string anywhere
(`grep -i cigar MW/*.ts` finds only a comment at `MW/model.ts:251`), so for this
display the tier is purely a byte knob: coarse rows have the same extents with
folded CIGARs.

### 1.2 What an adapter must provide

The contract is stated in `JC/agent-docs/handoffs/multiway-graph-native.md:15-27`
and matches the code: (a) anchor-with-no-target records, each clipped to the
window on both axes (`JC/plugins/comparative-adapters/src/clipFeatureToRegion.ts`;
CIGAR-exact clip when the record carries one, proportional otherwise,
`:40-80`), with the CIGAR dropped after the clip; (b) optionally, direct records
for a mate pair; (c) a `CoreGetInfo` header with `hasCoarseTier`, optionally
`anchorAssemblyName` and `lanes[{name,label,group}]`
(`MW/model.ts:143-200`). Today's providers:

- `MCScanBlocksAdapter`: reads the whole table and every BED up front, answers
  any column pair, and is the only adapter implementing `mateShape: 'grouped'`
  (`JC/plugins/comparative-adapters/src/MCScanBlocksAdapter/MCScanBlocksAdapter.ts:405`).
- `MultiPairwiseSyntenyAdapter`: N pairwise PIF children opened in parallel
  and merged into one observable per request (`MultiPairwiseSyntenyAdapter.ts:150-185`,
  `:220-237`, ids re-keyed `${childIndex}-…`), header folds the children's tiers
  (`hasCoarseTier` only when every child has one,
  `JC/agent-docs/reference/SYNTENY_LOD.md:135-143`), names the anchor, declares
  no `lanes`. `mateShape: 'grouped'` is ignored by every PIF adapter: each
  record arrives as one feature with one `mate`, and the display groups on the
  clipped `syntenyId` (file offset plus window). A mate-vs-mate query returns
  the empty answer, not an error (`:78-98`). A PIF is a bgzipped PAF written
  twice, once per side, pre-oriented and tabix-indexed under `q`/`t` (fine) and
  `Q`/`T` (coarse) prefixes (`JC/plugins/comparative-adapters/src/util.ts:580-660`).
- `MultiGenomeIndexedPAFAdapter`: one PanSN PIF, star or all-vs-all; an unstated
  pair raises `noSuchPairError` (`JC/plugins/comparative-adapters/src/util.ts:265`).
- `GbzBaseSyntenyAdapter` (`P/src/GbzBaseSyntenyAdapter/GbzBaseSyntenyAdapter.ts`):
  anchor-only (`:368`, a lane-assembly region emits nothing), one record per
  haplotype contig after the sibling join (`G/src/subgraph.ts:255-300`), header
  `lanes` = every haplotype in the graph minus the reference (`:265-313`; 464 on
  HPRC v2.1), `hasCoarseTier: false`, no `identity`, and a haplotype filter that
  runs after every walk has been extracted, identified and aligned
  (`:392-412`). Measured at context 1000 with both files hosted: C4 60 kb 5.0 s,
  CFH 8.1 s, KIV-2 130 kb 8.5 s, MHC class II 12.7 s, AMY1 12.8 s
  (`P/agent-docs/GBZ_HANDOFF.md:157-168`).

### 1.3 Where the "one gene row per lane" simplification lives, and what it forecloses

A lane is `Lane` in `MW/laneStack.ts:85-135`: an assembly name, a frame, a
`hasAnnotation` flag, the group placements in px, and two functions. The session
does not know lanes exist. Concretely:

- One annotation per lane, chosen by rank, never by the user
  (`MW/model.ts:908-950`). A lane cannot show a second track, a wiggle, variants,
  reads, or sequence, and the gene track it shows is not the track the user
  configured a display for; it is the raw adapter re-drawn through
  `geneGlyph.ts` with the canvas track's rules (design record 314-337).
- No per-lane navigation or zoom, by design: "Per-lane pan/zoom stays
  deliberately absent: the lanes re-fit to the anchor's viewport by design, and
  the launch above is the route to a lane you drive yourself" (design record
  310-312).
- One contig per lane (`pickContig`, `MW/laneDecision.ts:88-137`); a second copy
  is named in the header and reachable by pin, never drawn beside the first
  (design record 73-95).
- Self-comparison lanes are dropped (`rowAssemblies` removes mates whose
  assembly is the anchor's, `MW/model.ts:747`).
- The SVG export is the viewport at the current `scrollTop` (design record
  290-294), so a 44-lane figure is a screenshot of a scrolled canvas, not the
  stack.
- Height is divided until `MIN_LANE_PITCH = 22` px, then fixed and scrolled
  (`MW/laneStack.ts:14-24`); at the floor the glyph row is
  `clamp(22 - 12 - 6, 5, 18) = 5` px (`:46-52`), which is the E. coli figure's
  gene height.

The escape hatches are two: **Open ⟨assembly⟩ at the matching region**
(`openInNewView`, `MW/model.ts:1502-1521`), which opens an *unsynchronised* LGV
with the multiway track and that genome's annotations, and **Launch → Linear
synteny view (visible region)** (`MW/model.ts:1466-1490`), which is the stacked
view discussed in §2.3.

## 2. The two named tutorials

### 2.1 `ecoli_orthologs_synteny` (44 E. coli and Shigella under K-12)

**Data.** `JC/website/docs/tutorials/ecoli_orthologs_synteny.md`: a gene-symbol
join over RefSeq GFF3s (`symbols_to_blocks.py`) written as an MCScan `.blocks`
table with 44 columns; hosted at `jbrowse.org/demos/ecoli_orthologs/`. Measured
today: 44 assemblies (each a `ChromSizesAdapter`), 45 tracks, `ecoli.blocks.gz`
503 KB, blocks plus 44 BEDs 2.6 MB total, display `height: 970`
(44 × 22 px, the floor; `MW/laneStack.test.ts:212` pins that every checked-in
demo sizes its track to the whole stack). Every lane's genes come from its own
tabix GFF3.

**What the display does well here.** This is the case the display was built
for. Group keys are gene symbols, so one anchor gene chains through every lane
and `bridgeSkippedLanes` (`MW/multiwayGeometry.ts:229-258`) carries a group past
a lane that lacks it; the lane-genes fetch gives every lane real exon structure;
colour by symbol (`jexl:feature.name ? randomColor(feature.name)`) makes a
conserved gene one colour down the stack; the O-antigen figure is an honest
negative (each lane draws its own cluster and no ribbon). The adapter loads
2.6 MB once and answers every window from memory.

**What it does badly here.**

- *Readability at 44.* 5 px glyphs, 12 px labels, 22 px pitch. The figure is
  legible as a barcode, not as gene models. Past ~500 kb "the stack is
  unreadable and no figure should try: the display has no coarse tier, and at
  44 lanes the bridged ribbons of any sparse lane sweep the whole track"
  (`JC/agent-docs/reference/DEMO_DATASETS.md:300-302`).
- *Order is density, not phylogeny.* Densest-first (`rowAssembliesOf`) puts the
  K-12 derivatives on top at the O-antigen locus only because they share the
  most symbols; the reader is told "the reduced Shigella genomes fall toward the
  bottom without anything naming them". A 44-way stack wants a tree order; the
  seriation design is written but not built
  (`JC/agent-docs/ideas/ordering-synteny-lanes-by-similarity.md`).
- *44 lane-gene RPCs per settle* (one tabix query per lane; the per-lane
  staleness gate reduces a pan to the lanes whose grid cell moved, design record
  224-229). Fine at 44, and the reason the cost is linear in lanes.
- *No hiding of empty lanes automatically* (`hiddenLanes` is manual, design
  record 295-297).

**A user who wants more than one row per genome.** Nothing in-display. The
options today are: open a lane in its own LGV (unsynchronised; the multiway
track rides along so the new view is the same stack re-anchored, but the two
views do not follow each other), or launch a `LinearSyntenyView`. For a blocks
table the launched stack works: the adapter answers any column pair, so every
level between adjacent rows draws (`columnPairs`,
`MCScanBlocksAdapter.ts:415-440`). The costs are in §2.3.

### 2.2 `hg38_vertebrates_synteny` (hg38 and eight UCSC genomes)

**Data.** `JC/website/docs/tutorials/hg38_vertebrates_synteny.md`: a
`MultiPairwiseSyntenyAdapter` over eight UCSC liftOver chains converted to
indexed PAF (`hg38To<Genome>.over.pif.gz`, 23-179 MB each, measured today via
`Content-Length`), hub assemblies and `ncbiRefSeq` tracks lifted from each
genome's hub config. Five of the eight PIFs predate the coarse tier (no `#pif`
header; `DEMO_DATASETS.md:373-386`), so the star serves the fine tier at every
zoom. The hosted config's display height is 200 (nine rows at the 22 px floor
is 198), while the tutorial session overrides it to 600.

**What the picture actually contains.** I pulled the records the display
fetches for the TP53 window (`tabix … tchr17:7400000-7700000`, the hg38 side of
each PIF). Each lane places the window with *one whole-chain record*:

| PIF | records overlapping 300 kb | the chain record | CIGAR ops | CIGAR bytes | in-window I / D bp | largest in-window gap |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| hg38ToMm39 | 8 | chr17:1.34-15.72 Mb ↔ mm39 chr11, `-` | 300,251 | 778,634 | 145,673 / 167,860 | 25,367 |
| hg38ToCanFam6 | 2 | chr17:4.00-15.72 Mb ↔ chr5 | 275,447 | 719,146 | 93,987 / 144,020 | 31,736 |
| hg38ToBosTau9 | 3 | chr17:1.34-15.72 Mb ↔ chr19 | 280,390 | 734,277 | 160,036 / 141,473 | 89,487 |
| hg38ToPanTro6 | 1 | chr17:0.49-21.62 Mb ↔ chr17 | 34,169 | 104,290 | 3,604 / 4,432 | 2,202 |

The display clips that record to the window (CIGAR-exact at the two edges,
`clipFeatureToRegion.ts`), then draws it as one parallelogram and composes the
mate-to-mate links between adjacent lanes by linear interpolation
(`MW/composeLaneLinks.ts:37-52`). The tutorial's caption for the figure reads
"Every lane places the window as one straight block", and the text says "this
is a neighbourhood conserved across the mammals, and the picture says so by
having nothing to point at". Inside that same window the mouse chain carries
146 kb of insertion and 168 kb of deletion in 3,450 gaps, the largest 25 kb;
the cow chain has an 89 kb gap at chr17:7,515,121. The straightness is the
display's blindness to the CIGAR, not conservation. At 189 bp/px (300 kb over
1588 px) the interpolation error at a composed mouse-to-dog link can reach
130 px, and a cow ribbon endpoint can be 470 px from where the alignment puts
it. The `identity` colour mode cannot rescue it: a composed link carries no
`identity` and keeps the slot colour (`MW/multiwayGeometry.ts:146-157`).

The second figure (17p near PMP22) is honest for a different reason: there the
chains *break*, breaks are separate records, and separate records the display
does draw.

**Fetch cost of "fine at every zoom".** A 300 kb window pulls the whole chain
row per lane: 0.7-0.78 MB of CIGAR text for mouse, dog and cow, parsed and
walked in the worker for every static-block change, to produce one clipped
extent. The five headerless PIFs pin the star to fine
(`SYNTENY_LOD.md:135-143`), and the display cannot ask for coarse on its own
behalf even though it discards the CIGAR. The tutorial's statement that the
**Level of detail** entry "is offered once every child carries a coarse tier"
(`hg38_vertebrates_synteny.md`, "The composed track") is not what the code does:
the menu is gated on the *threshold slot*, which `MultiPairwiseSyntenyAdapter`
declares unconditionally (`trackHasLodTiers`, `lodTier.ts:225-229`;
`MultiPairwiseSyntenyAdapter/configSchema.ts:63`), so on this demo the menu
shows and never switches anything. What a coarse tier is worth is measured:
1.31 MB against 64.23 MB on a whole-genome pass over a 130 MB PIF, 49× fewer
bytes (`JC/agent-docs/measurements/pif-tier-wire-bytes.json`).

**Ribbons.** Only the anchor→first-mate gutter comes from group placements; from
the second gutter down the ribbons are composed links (`MW/multiwayGeometry.ts:259-289`,
`row > 0`). With one record per lane that is one parallelogram per gutter. The
gene glyphs are the real content of this picture, and they are correct: they are
drawn at each genome's own coordinates from its own track.

**A user who wants more than one row per genome, from this track.** **Launch →
Linear synteny view (visible region)** seeds a dialog from the multiway track
(`MW/model.ts:1466-1490`; `JC/plugins/linear-comparative-view/src/LaunchSyntenyView/regionLaunchMenuItems.ts:128-176`),
resolves one panel per mate, and builds a `LinearSyntenyView` with the anchor at
index 0 by default and **the same track on every level**
(`LaunchSyntenyView/buildSyntenyViewSpec.ts:53-104`, `tracks: panels.map(() => [trackId])`).
For a star that means level 0 (anchor vs first mate) draws and every other level
asks `MultiPairwiseSyntenyAdapter` for mate-vs-mate, which returns nothing by
design (`MultiPairwiseSyntenyAdapter.ts:78-98`; a `MultiGenomeIndexedPAFAdapter`
star raises `noSuchPairError` instead). Dragging the anchor to the middle of the
dialog's list gets two drawing levels of eight (`LaunchSyntenyView/panelOrder.ts:65-75`
says so in its comment). The stacked view has no notion of "every level anchored
on the hub"; a level is `views[i]`/`views[i+1]` in ten files (design record
203-206). So the honest answer for a star is: eight rows, one or two bands.
Two more things about that route are worth knowing. The rows come from the
`SyntenyDiscoverMates` RPC over the dataset (`LaunchSyntenyView/discoverMates.ts:41-81`),
not from the display's lane selection or `rowOrder` — the launch forgets what
the reader chose, and on a GBZ track it is a second full-cohort window fetch
that proposes every haplotype the window places as a panel. And each level
instantiates its own copy of the synteny track, display and canvas backend,
with heights budgeted as `max(40, min(100, 320 / levels))`
(`JC/plugins/linear-comparative-view/src/LinearSyntenyView/levelHeightBudget.ts:12-23`),
so an eight-mate launch is eight 40 px bands, seven of them empty.

### 2.3 The two routes, costed

| | MultiWay lanes (one track) | LinearSyntenyView (one LGV per row) |
| --- | --- | --- |
| **Control** | Order by drag/menu, hide, pick, pin contig, re-anchor; no per-lane zoom, no extra tracks, no per-lane locstring | Full LGV per row: any tracks, independent navigation, rubberband, feature detail; order by moving views; no densest-first, no bridging, no lane picker |
| **State** | `rowOrder`, `hiddenLanes`, `selectedLanes`, `lodMode` on one display (`MW/model.ts:216-247`); features volatile | N `LinearGenomeView` models plus N-1 `LinearSyntenyLevel` models, each level holding its own full track model, display and rendering backend (`JC/plugins/linear-comparative-view/src/LinearComparativeView/model.ts:126-140`, `:433-467`; `LinearSyntenyViewHelper/stateModelFactory.ts:56-95`); every row's tracks persist |
| **Fetches** | 1 star fetch (+ N children inside the adapter) + N lane-gene RPCs + (N-1) link RPCs for nameless non-star sources | N-1 synteny fetches (one per level, each its own display) + each row's own track fetches; each level refetches independently on its own pair of viewports |
| **Performance** | One canvas, ~10 GPU draw calls per lane (§3), 22 px per lane floor | N LGV React trees and rulers, a synteny canvas per level; rows are ≥ ruler height each, so 8 rows fill a screen and 44 do not fit |
| **Correctness** | Lane frames are affine fits (§4.1); composed links interpolate; ordering by placement count (§4.3) | CIGAR-exact ribbons and per-base detail on each level; but for a star only levels touching the anchor draw, and a level with an unstated pair is either blank (MultiPairwise) or an error (MultiGenome) |
| **Scale** | linear in N, readable to ~50 with scrolling | usable to ~5 rows; the design record calls a cohort "a multiple alignment rather than a stack of pairwise bands" (`comparative-adapters/src/util.ts:255-263`) |

The "harder to control" the maintainer names is real and has a specific shape:
a stacked view is N independent navigators tied by adjacent-pair bands, so the
one thing the lane stack does for free — keeping every genome pinned to the
anchor's viewport — is the thing the stack cannot do, and for a star source the
bands are missing where a reader expects them.

## 3. Speed and scalability

### 3.1 Fetch counts per settle

N = mate lanes drawn (after selection).

| cost | 8 | 64 | 464 | 4,000 | where |
| --- | ---: | ---: | ---: | ---: | --- |
| ortholog fetch (RPCs) | 1 | 1 | 1 | 1 | `MW/afterAttach.ts:50-58` |
| …inside a `MultiPairwise` star: child tabix reads | 8 | 64 | 464 | 4,000 | `MultiPairwiseSyntenyAdapter.ts:150-185` |
| …inside a PanSN PIF: records parsed | ≈lanes × records/lane | | | | one index read |
| …inside GBZ: walks extracted, identified, aligned | every haplotype in the window (465 at KIV-2) regardless of N | same | same | same | `P/…/GbzBaseSyntenyAdapter.ts:381-412`; `P/agent-docs/HAPLOTYPE_WALKS_REVIEW.md:36-39` |
| lane-gene RPCs (lanes the session holds) | 9 | 65 | 465 | 4,001 | `MW/model.ts:1004-1040` |
| lane-link RPCs (nameless, non-star only) | 7 | 63 | 463 | 3,999 | `MW/model.ts:1053-1090` |
| header read | 1 | 1 | 1 | 1 | `MW/afterAttach.ts:264-272` |

The star fan-out is hidden inside one RPC but is still N HTTP range reads per
window; `MultiPairwiseSyntenyAdapter` issues them concurrently. The lane-gene
and lane-link fetches are concurrent with per-lane staleness, so a pan that moves
one lane's grid cell costs one RPC, not N (design record 224-229) — that is
the one place where the display is sub-linear.

### 3.2 Main-thread work per settle

- `groupFeatures`: O(records). `rowAssembliesOf`: O(groups × mates).
- `laneGeneAdapters` (`MW/model.ts:908-950`): O(sessionTracks × lanes)
  `isSameAssemblyName` calls, recomputed whenever `rowAssemblies` changes. A hub
  session with 500 tracks and 464 lanes is 232,000 alias resolutions per
  recompute; at 4,000 lanes, 2 million. This is the first main-thread cliff
  at cohort scale and it is not in any test.
- `decideLaneFrames`: per lane, `fitLane` scans every group and
  `orientationVote` sorts the shared set: O(N × G log G). Measured at 7 lanes
  and 660 groups: 12.7 ms of MobX per zoom step packing the cells (design record
  542-544); glyph cells 34 ms at 5,009 on-canvas genes
  (`JC/plugins/linear-comparative-view/benches/multiwayZoomCost.probe.ts:19-25`).
  Linear extrapolation to 464 lanes at the same group count is ~0.8 s per
  settle, before rendering.
- `pairLinks` composes every adjacent pair from scratch on every fetch commit
  (`MW/model.ts:1128-1175`): O(N × records).

### 3.3 Rendering

`renderLayers` (`MW/model.ts:1318-1330`) is `bands + (N gutters + bridges) + N tick
layers + 2N glyph layers`, and `GpuMultiWayRenderer.render`
(`MW/GpuMultiWayRenderer.ts:85-101`) loops over them writing uniforms and
issuing a draw per pass. A glyph layer runs the feature track's rect, line,
chevron and arrow marks (`MW/multiwayGlyphMarks.ts:27-37`;
`JC/plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphMarks.ts:29-62`), so
the frame cost is roughly 10 draw calls per lane whatever is on screen: ~80 at
8 lanes, ~4,600 at 464, ~40,000 at 4,000. Nothing culls layers that are scrolled
out of the viewport. The pick path (`pickRibbon`) draws every ribbon cell into
an offscreen pick canvas per hover.

### 3.4 Pixels

`laneContentHeight = max(height, rows × 22)` (`MW/laneStack.ts:22-24`): 464 lanes
is a 10,208 px scrolling stack with 5 px gene rows; 4,000 lanes is 88,000 px. A
scrolled stack is still fully laid out and fully drawn.

### 3.5 Session and config

The display persists four small properties. The real state cost of a cohort is
upstream: a lane draws genes only if the session holds an assembly for it
(`holdsAssembly`), so a 464-lane HPRC config needs 464 assemblies (GenArk
2bit + chromAlias each, `JC/agent-docs/reference/PANGENOME_GRAPHS.md`
"Any donor can be loaded as an assembly") and 464 annotation tracks (the eight
CAT GFF3s in `demos/hprc_multiway` are 114-127 MB bgzipped each,
`DEMO_DATASETS.md:339-345`). The PIF product is linear too: eight haplotypes at
16 MB each today (`P/agent-docs/HAPLOTYPE_WALKS_VISION.md:37-38`), so 464 is
~7.4 GB and 4,000 is ~64 GB of hosted PIF, and the review puts any per-haplotype
store at 6-8 GB per product at 464 and 50-70 GB at 4,000
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
- **GBZ:** the fetch. 5-13 s per window for every haplotype (the Paths scan of
  53,150 paths is once per database, `GBZ_PLAN.md:147`), `nodeLimit` refusing
  wide windows, and no coarse tier. Lane selection saves the display's per-lane
  work and nothing on the query (`GBZ_PLAN.md:297-301`).

## 4. Incorrectness

### 4.1 Alignment sources are drawn as affine blocks

Verified in §2.2 with the TP53 records. The chain of causes: `clipToRegion`
clips a record to the window on both axes exactly (`clipFeatureToRegion.ts:56-80`
walks the ops) and then drops the alignment string; the display draws the
clipped extent as one placement (`groupRunsOnRow`, `MW/layoutMultiWay.ts:319-349`);
`composeLaneLinks.projectOntoLane` maps an anchor sub-interval into a lane by
the record's overall ratio (`MW/composeLaneLinks.ts:37-52`). The tests pin the
interpolation as specified (`MW/composeLaneLinks.test.ts`) and nothing measures
either against a CIGAR oracle. The design record chose this ("per-base
alignment lanes … the wrong one to bolt onto this display", lines 22-34) for
rendering reasons; the consequence that *placements* — not per-base marks — are
wrong by up to the largest interior indel was not stated anywhere I found, and
the hg38 tutorial presents the artefact as biology.

### 4.2 Three documents, two strand semantics

`ribbonColorer` colours a ribbon by the product of the two runs' orientations
against the anchor — "the record's strand, as the synteny view means it — and
not the drawn twist: a lane whose every placement is inverted is drawn flipped,
so its ribbons run straight while every one of them is an inversion"
(`MW/multiwayGeometry.ts:123-131`, applied at `:253` and `:286`). The config slot
says the opposite: "`strand` reads whether the ribbon is crossed — the lower
placement runs the other way from the upper one" (`MW/configSchema.ts:86`); the
design record says "Strand reads the DRAWN twist rather than a record's strand"
(lines 301-306); the tutorial says "paints a ribbon that crosses"
(`hg38_vertebrates_synteny.md`, "Color ribbons by → Strand"). For any lane drawn
`[rev]` the code and the two prose statements disagree on screen. No test pins
the semantics for a flipped lane.

### 4.3 "Densest first" rewards fragmentation on an alignment source

`rowAssembliesOf` sorts by placement *count* (`MW/layoutMultiWay.ts:207-221`).
For a named table that is "how many genes this lane shares". For a nameless
source every record is one group with one placement, so a haplotype whose
alignment *breaks* in the window has more placements than one that runs through.
At the CFH window the four CFHR3/CFHR1 deletion carriers are two records each
and the non-carriers one (`JC/agent-docs/reference/HPRC_RELEASE2.md:226-240`),
so the carriers sort to the top by construction and the reader is told they are
"densest". The `weight` the contig vote already uses (anchor bp for nameless
records) is the right quantity and is sitting on every group.

### 4.4 The launched stack from a star

§2.2: `buildSyntenyViewSpec` puts the same track on every level and the anchor
on top by default; for a star every level but the first is empty
(`MultiPairwise`) or an error (`MultiGenomeIndexedPAF`, GBZ answers nothing for a
lane region, `P/…/GbzBaseSyntenyAdapter.ts:366-368`). The dialog's own comment
knows a three-panel launch "wants the anchor in the middle"
(`LaunchSyntenyView/panelOrder.ts:65-68`); the default is still 0 and nothing
warns when the source is a star with more than two mates.

### 4.5 Lane-link tier and window on a mate lane

The pair fetch is issued at the *anchor's* tier over the upper lane's region
(`MW/model.ts:1069-1086`), while that lane may be drawn at up to 80× the anchor's
bp/px (`SCALE_LADDER`). Recorded as open in the handoff
(`multiway-graph-native.md`, last bullet). Harmless for byte cost, wrong in
principle for a tiered all-vs-all file.

### 4.6 Coordinates, inversions and the reversed anchor

I looked for the classic errors and did not find them: mate orientation is read
from the pair, never the mate's transcription strand (`MW/layoutMultiWay.ts:58-70`,
pinned by `layoutMultiWay.test.ts:881`); an inversion is an ordered span pair
joined end to end so two lanes both reversed against the anchor draw straight
between themselves (`groupRunSpansOnRow`, `:366-380`; `RibbonBuilder.add`,
`MW/multiwayGeometry.ts:89-100`); a direct link reverses its lower span on `-`
strand against lanes that are themselves mirrored by `rowFrameX` (`:275`), and I
worked the four flipped/unflipped cases by hand — they compose correctly; the
anchor axis clips rather than tests (`MW/anchorAxis.ts:31-50`, three tests); a
horizontally flipped view mirrors every lane without re-deciding
(`frameFromDecision`, `MW/laneDecision.ts:400-422`, `laneDecision.test.ts:90`).
Coordinates are chromosome-local numbers throughout, no 2^32 issue.

### 4.7 A near-miss worth a sentence

`SyntenyFeature.get('name')` answers the mate's refName when the record has no
name (`JC/plugins/comparative-adapters/src/SyntenyFeature/index.ts:34-35`), and
the clipped copy is a `SyntenyFeature` (`clipFeatureToRegion.ts:107`). Had that
object reached the display, every star record would be "named" by its mate's
contig, `featuresAreNameless` would be false, and `groupFeatures` would fold
every gorilla-chr17 and chimp-chr17 record into one group drawn as a chain.
It does not reach the display: `CoreGetFeatures` returns `f.toJSON()` and
rebuilds plain `SimpleFeature`s (`JC/packages/core/src/rpc/methods/CoreGetFeatures.ts:16,46`),
and the getter is not data. The display's "is this source an alignment" test
therefore depends on a serialisation boundary that no test names.

### 4.8 Documentation that disagrees with the code

Beyond the strand semantics (§4.2) and the LOD menu (§2.2): the user guide has
no multiway section at all (`JC/website/docs/user_guide.md` links the tutorials
and stops; the design record's own line 297-299 lists this as open);
`multiway_synteny_grape_peach_cacao.md` equates "no annotation" with "no GFF3"
while `MW/laneAnnotation.ts` ranks GTF, BigBed, BED and more;
`hprc_multiway_synteny.md` documents the Lanes submenu without "Show all lanes"
and "Reset lane order" (`MW/menus.ts:277-284`); `pangenome_hprc.md` documents
`GbzBaseSyntenyAdapter`'s slots with no config page for an adapter that lives
in another repository; and the figure manifest lacks entries for six multiway
figures the docs reference. None of the `multiway_synteny/*` specs asserts
anything beyond the ready phase (`website/scripts/generate-screenshots.ts:160-196`),
so a figure that draws the wrong thing still ships.

### 4.9 What the tests do not pin

Every fixture is two or three mate lanes and a handful of groups. Nothing
exercises: a star of ≥3 mates with mixed orientations end to end (ribbon
colour, composed links and headers together); composed links against a CIGAR
oracle; ordering semantics for a nameless source; `laneGeneAdapters` cost or
correctness with hundreds of tracks; a window on a lane whose record carries an
interior gap; the picker above ~10 lanes; anything at 44 or 464 lanes beyond the
height assertion. The handoff also lists a hung lane fetch holding the
first-load phase at `loading` with no deadline
(`multiway-graph-native.md`, "Smaller items").

### 4.10 The lane sort is exact, and its tie-break is file order

`rowAssembliesOf` sorts lanes by summed weight and tie-breaks on `appearance`,
the first-seen index over the anchor-sorted groups. The weights are integers —
one per gene, or anchor bp for an alignment — so the sort is exact and
independent of accumulation order: given the same feature list the lane order
is fully determined.

At the HPRC CFH window the tie-break decides everything. The four non-carrier
haplotypes tie at exactly 300,000 anchor bp and the four carriers at exactly
215,316, the 84,684 bp the CFHR3/CFHR1 deletion removes, so within each group
the stack is simply PIF file order. `MultiGenomeIndexedPAFAdapter` sorts its
concurrent reads by `fileOffset` precisely so that order is reproducible, and a
single-region fetch is therefore deterministic.

The exposure is `ComparativeAdapterBase.getFeaturesInMultipleRegions`, which
`merge`s the per-region streams: on a multi-region view the arrival order varies
run to run, and against ties this size that is enough to swap two lanes. It
wants the file-order discipline the indexed PAF adapter already applies.

The inverted lane order between the `pangenome/hprc_cfh_haplotypes` and
`multiway_synteny/hprc_lane_menu` figures is **not** that bug, and an earlier
version of this section was wrong to say it was. The hosted PIF was rebuilt from
HPRC release 2.1 on 2026-09-06, between the two captures; `hprc_lane_menu` has
not been reshot since 2026-09-05, so the two pictures are of two different
datasets. Reshooting it is the fix. `multiway_synteny/hg38_vertebrates_17p_break`
is stale the same way against `05ec50660e`: it draws the marmoset lane `[rev]`
at `2.4Mbp 2x` where today's code decides forward at rung 3.

### 4.11 A long `alsoOn` overflows an exported figure

`pickContig` keeps every contig at `ALSO_ON_SHARE` (0.2) of the chosen one's
evidence, uncapped (`MW/laneDecision.ts:127`). On a chromosome assembly that is
one or two; on a fragmented one, ten scaffolds each clear the bar against every
other. `LaneHeaders.tsx` is HTML so the label ellipsizes, and
`SvgLaneHeaders.tsx:28-37` draws `row.label` as a bare `<text>` at x=2 with no
clip, so the export's header runs under and past its own scale label — the two
presenters saying different things, which `laneHeader.ts:57-64` says the shared
derivation exists to prevent. Cap at the source: the header, the SVG and the
`Show <contig> in this lane` menu all read that one list.

## 5. Suitability for graph pangenomes

### 5.1 What the display needs from a graph route

1. **Records per chosen haplotype, not per haplotype in the graph.** Today the
   GBZ adapter returns every walk and the display filters
   (`GbzBaseSyntenyAdapter.ts:381-412`). The reader's `keepHaplotypes` and the
   W-line direction fix exist at `G/` HEAD (`add1f2f`) but are unreleased and
   unused by the plugin (the plugin pins 2.3.0). The review's finding is that
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

### 5.2 Is row-per-haplotype the right frame at 464 or 4,000?

No, and the plugin's own documents already say so ("464 haplotypes are not a
lane stack", `multiway-graph-native.md`; "89 lanes is not a lane stack any more
than 464 are", `GBZ_HANDOFF.md:298-301`). The three reasons are independent and
each is sufficient:

- *Pixels.* 22 px per lane with a 5 px gene row is not a reading at 464, and a
  scroll does not fix a stack whose information is "which of these rows differ".
- *Fetch.* Every window is the whole cohort until the reader takes a set
  (§5.1), and the walk store the vision proposes still targets "eight lanes
  under a second", not 464 lanes under a second.
- *Picking.* The question at cohort scale is "which haplotypes differ here", a
  genotype/carriage question the alignment cannot answer cheaply; the design
  record lands the same way ("the wave VCF's genotype matrix, not the alignment",
  lines 108-114).

At 4-16 haplotypes the frame is right: it is the only display in the tree that
puts each haplotype in its own coordinates with its own genes under a shared
anchor, and the CFH figure is the proof. The honest scaling story is therefore
two surfaces with a hand-off, not one surface that grows:

1. **A carriage/genotype-first picker** over the cohort: the `pgbi.vcf.gz`
   snarl VCF (462 haplotypes of `GT`, 1.7 s for a 70 kb window remotely,
   `PANGENOME_GRAPHS.md` "Release 2 files nothing here reads yet") or the wave
   VCF through `LinearMultiSampleVariantDisplay`, with `TreeSidebarMixin`'s
   cluster-by-identity ordering; rows at 1-2 px each, 464 or 4,000 of them; a
   click or a lasso yields a haplotype set.
2. **This display as the locus reading** for that set: the set becomes
   `selectedLanes` (session state already), and — once the reader takes a
   filter — the fetch.
3. **The graph view** taking the same set: `haplotypes` on `GetSubgraph`
   (`HAPLOTYPE_WALKS_VISION.md:70-73`), Sample rows drawing the chosen set.

### 5.3 Tie-ins to the graph plugin

**`launchFromGraph`** (`P/src/launchFromGraph/launchFromGraph.ts`) launches an
LGV or a `LinearSyntenyView` from the graph selection, choosing contributors by
which sample owns each anchored node (`contributors.ts:97-156`) and keeping only
those that resolve to a loaded session assembly (`:187-195`) — on HPRC that is
the reference alone (`contributors.ts:172-178`). It never constructs a MultiWay
display. The cheap, concrete bridge is: the graph selection's *samples* (every
visitor of the selected nodes is already recorded in `GraphNode.samples`,
`P/src/GraphGenomeView/pathAnchoring.ts:132`) become `selectedLanes` on the
session's multiway track over the same anchor window. That is a menu item and
no new data path, and it is the first place the two views would agree on what a
set of haplotypes is.

**Sample rows** (`P/src/GraphGenomeView/layout/sampleRowLayout.ts:81-149`) draws
each off-reference node once, in the row of the reference if it visits, else
the *first path in file order* (`pathAnchoring.ts:123`,
`visits.find(v => v.path === reference) ?? visits[0]`), and keeps the rest in
`samples`. The header comment states the limit: "drawing a segment once per
carrier needs the layout to emit more nodes than the graph has, which the
renderer keys by node id and cannot do" (`sampleRowLayout.ts:27-35`). So on a
GBZ cut with every W line it shows *attribution*, and the KIV-2 figure shot from
an eight-haplotype cut showed exactly that. Fixing it to draw carriage means
per-(node, carrier) positions and a renderer key other than node id — and the
result, a row per haplotype with a tube wherever it carries a node, is the
genotype matrix drawn as tubes. That is the reason not to build it there: a
matrix display already draws carriage at cohort scale, and Sample rows should
draw the *chosen* set (with `keepHaplotypes` the cut only contains those, so
first-visit-wins is nearly attribution-free) rather than pretend to draw 464.

**The reader.** Today's review found the reader's `align()` and
`gfa_to_pairwise_paf.py` emit different CIGARs for the same walks by design
(`HAPLOTYPE_WALKS_REVIEW.md:280-295`; `50I50D` against `50X`) and nothing measures
them against each other. For *this* display the difference is invisible
(CIGARs are dropped after the clip), but it decides the clipped extents where a
record straddles the window edge, and it will matter the moment §6.A is built.

## 6. Approaches and recommendations

**A. Alignment fidelity (§4.1).** Options: (1) leave, and caption honestly;
(2) emit one placement per gap-free run from the CIGAR walk the clip already
performs, splitting a record at any I/D above a threshold (the coarse tier's
10 kb bound is the natural one; `clipSyntenyFeature` already walks the ops);
(3) per-base lanes, which the design record rejected for renderer reasons.
Recommend (2), adapter-side in `clipFeatureToRegion` under a `splitAtGapBp`
option the display passes: group keys are unchanged (one record, several
placements, `groupRunsOnRow` already merges only *overlapping* runs), ribbons
subdivide, composed links interpolate within runs, and the TP53 picture starts
telling the truth. Cost: one function and its tests, plus a re-shoot of two
figures. Also fix the hg38 tutorial's caption either way.

**B. Ordering (§4.3).** Sum `group.weight` per lane in `rowAssembliesOf` instead
of counting placements; one line, one test. Then, separately, the gene-group
seriation the ordering document specifies as step 1 (main thread, no RPC), which
is what the 44-way page needs.

**C. Bytes (§2.2, §3.7).** Rebuild the five headerless liftOver PIFs (the
handoff already lists this; the measured saving is 49× on a whole-genome pass).
Then let this display prefer `coarse` whenever the star has it: it discards the
CIGAR after clipping, so the fine tier buys it nothing but bytes. A
display-level default of `lodMode: 'coarse'` when `hasLodCapableAdapter` is a
two-line change; do it only after A, since A is the one consumer of the fine
CIGAR this display would ever have. Gate the LOD menu on the header's
`hasCoarseTier` rather than the slot so it stops offering a switch that cannot
switch. Note the coarse tier can never engage on a bacterial genome at the
default threshold (E. coli whole-chromosome is ~3.2 kb/px against a 10,000
threshold, `JC/agent-docs/reference/HOSTING.md:107-137`), so the E. coli
case is bounded by lanes, not bytes.

**D. More than one row per genome (§2.3).** Options: (1) let a lane host
tracks — a frame-projected track container per lane; large, and it recreates
the deleted `MultiLGVSyntenyDisplay` (`884a126861`, ~4,000 lines) by another
route; (2) the stacked launch with the anchor *repeated* between every pair of
mates — `views` may name one assembly twice, so `[m1, anchor, m2, anchor, m3]`
makes every level a direct pair on a star today at the cost of 2N-1 rows;
(3) a hub layout in `LinearSyntenyView` (every level anchored on a designated
row) — the design record counts "level = adjacent gap" in ten files, so this is
a view redesign; (4) a **synced per-lane view**: the existing "Open ⟨assembly⟩
at the matching region" made to *follow* the lane's frame (the lane decision is
a `{pivotAnchor, pivotLaneBp, rung, flipped}`; `SyntenyFollow` already navigates a
real LGV from pairwise data). Recommend (4) as the product answer — the lane
stack stays the overview, the drill-down is a full LGV that tracks the lane —
and (2) as the immediate fix for the star launch (default the anchor to the
middle for ≤2 mates, offer "repeat anchor between rows" for a star with more,
say in the dialog which levels will be empty otherwise, and seed the panel list
from `rowAssemblies` when the launch comes from this display rather than
re-discovering mates over the whole dataset). Leave (1) and (3) alone.

**E. Cohort scale (§3, §5.2).** Do not extend row-per-haplotype. Concretely:
make a graph source require a lane set (the `lanes` slot is already how
`demos/hprc_multiway` opens on eight; "every lane the source places" should not
be the default when the header declares more than, say, 32 lanes — refuse with
the picker open); cull scrolled-out layers in `renderLayers` and cache
`laneGeneAdapters` by (track set, lane set) before anyone opens 100 lanes; build
the genotype/carriage picker as the cohort surface and hand its set to
`selectedLanes`. The picker dialog itself is fine to ~500 and should not be made
to scale further.

**F. The graph data path (§5.1).** In order: release and adopt the reader's
`keepHaplotypes` and W-direction fix (the plugin is on 2.3.0 and today's fixes
sit after the tag); pass a haplotype set into `alignments()` for the quarter it
saves; static cuts with `--keep` for every tutorial locus now; then the
companion's reference-anchored samples and the per-path walk, which is the only
route to "eight lanes out of four thousand read eight haplotypes' worth of
data". Add `identity` to the reader's records so one colour mode stops being
dead. Measure `align()` against `gfa_to_pairwise_paf.py` on the E. coli oracle
before A lands, because A is the first consumer of the CIGAR's interior.

**G. Sample rows (§5.3).** Do not rebuild the renderer for carriage. Give the
cut a sample set (`keepHaplotypes` → `GetSubgraph`) so the rows are the chosen
haplotypes, keep first-visit-wins for the shared nodes, and route carriage
questions to the matrix.

**H. Leave alone.** The lane decision and its hysteresis; the cell/layer
renderer and its parity tests; the gene glyph parity with the canvas track; the
per-lane staleness on the dependent fetches; the lane picker at its current
scale; the E. coli and primate demos as they stand.

**I. Redesign.** The ordering rule for nameless sources (B); the placement of an
alignment record (A); the launch-from-star route (D2); the default lane set for
a declared-lane source (E); and the cohort story, which is a second display and
a hand-off rather than a bigger stack (E, F).
