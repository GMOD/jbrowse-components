---
name: pangenome-graphs
description: How a graph reaches JBrowse — what rGFA and GFA can say about coordinates and carriage, the one-node-per-bubble detail level, measured ceilings on the HPRC index, and pairwise PAF from a graph's walks. Read before touching a graph adapter or pangenome figure.
kind: spec
---

# Pangenome graphs

How a graph reaches JBrowse, what each format can and cannot say, and the
findings that are expensive to re-derive.

The view itself is a third-party plugin (`jbrowse-plugin-graphgenomeviewer`; the
package, bundle, repo and hosted prefix all spell `graphgenomeview**er**`, only
`test_data/graphgenomeview/` drops the `er`). User docs are
`website/docs/user_guides/graph_genome_view.md`; the plugin's own queue is its
`IDEAS.md`. A graph opens as a track of the linear view (the plugin's
`GRAPH_TRACK.md` records how it cuts and re-cuts); the standalone
`GraphGenomeView` opens a whole GFA file. An `RgfaTabixAdapter` track lists
`LinearGraphDisplay` first and the segments lane (`LinearBasicDisplay`) second.

**A plugin store bump moves the figures.** Every config names the plugin list's
`latest/` url on jbrowse.org, and `pnpm check-live-configs` refuses any other
(`test_data/graphgenomeview/README.md`). A publish reaches readers when
jbrowse-plugin-list bumps its pin, so graph figures move at the next regen with no
commit here; read it with `pnpm figures:report`. Compare the plugin's commit dates
against the `dist/` mtime before assuming a bump re-renders anything: "unpushed
commits" is not "the deployed bundle lacks them", and bundle hashes are
content-addressed and say nothing about lineage (grep the served file).

## Coordinates are the only real difference between formats

- **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) states
  `SN`/`SO`/`SR` per segment.
- **A plain GFA** (pggb, odgi, vg, base-level Minigraph-Cactus) states the same in
  path order: walking a path assigns each visited segment an interval on that
  path's sequence. P and W lines are both read. A W line names sample and
  haplotype and gives the start offset outright; a P line hides an `odgi extract`
  offset in a `:start-end` name suffix. A graph mixing them (Minigraph-Cactus: P
  reference, W haplotypes) anchors on the P line by file order.

| Route | Built by | Gives |
| --- | --- | --- |
| indexed track (rGFA) | `scripts/build_rgfa_tabix.sh` | a graph track at any locus, hover sync, the segments lane |
| indexed track (plain GFA) | `scripts/build_pggb_tabix.sh` → `pggb_gfa_to_bed.py` | the same, plus `SM:Z:` carriage |
| coarse tier (any graph) | `scripts/build_bubble_tier.sh` → `bubbles_to_tier_bed.py` | one node per bubble, so a whole chromosome draws |
| a GFA file | `odgi extract` / `vg chunk`, then Add → Graph genome view | one window, no index; the view walks a chosen path in-app (`pathAnchoring.ts`) |

Every builder emits `<prefix>.segs.bed.gz` (`stableName start end segmentId rank
[tags]`) and `<prefix>.links.bed.gz` (one row per L-line **per endpoint**, both in
full, because a neighbour usually sits on another sequence tabix cannot look up by
id). `RgfaTabixAdapter` reconstructs a synthetic rGFA from them (`formatSubgraph`
in `rgfaBed.ts`), so nothing downstream learned a second format.

## The tag column is the extension point

Column 6 of `segs.bed` is a space-separated list of GFA tags, written verbatim
onto the synthesized S-line; the parser reads arbitrary tags into
`GraphNode.tags`. A producer states something new without touching adapter,
parser or renderer. Tags in use: `SM:Z:` (carriage, from `pggb_gfa_to_bed.py`),
`ct:Z:` (`bubble`/`backbone`) and `cn cw cs cl cv` (segments, traversals,
shortest, longest, inversion), from `bubbles_to_tier_bed.py`.

- **The tag grammar is checked** (`GFA_TAG` in `rgfaBed.ts`). Non-conforming
  fields are dropped, since a bare old-format comma list on an S-line is a
  malformed GFA.
- **Carriage is per haplotype** (`HG002.1`); keying on the PanSN sample merged a
  diploid sample's haplotypes. `gfaConverter.makeNode` reads `SM:Z:` into
  `GraphNode.samples`. Precedence is walk-first: `pathAnchoring.anchorNode`
  rebuilds `samples` from path visits when there are any; the tag is the fallback
  for an indexed cut. `rgfaBed.test.ts` pins "SM:Z: on a segs row reaches
  GraphNode.samples".
- **The linear side reads it too.** `segmentSamples` puts `samples` and `carriers`
  (its length) on each feature, absent on an rGFA, so a `color` jexl reads
  `feature.carriers`. The lane is one box per segment, the unit the graph states
  carriage in; `odgi depth` averages short accessory stretches into windows.
- A precomputed `LO:Z:` layout tag was the removed gfa-to-tabix tree's adr-028
  (`git show 3b98dbb985^:agent-docs/architecture-decision-records/adr-028-offline-graph-layout-tag.md`).

## Level of detail: one node per bubble

The fine tier draws one node per segment, so the drawable window tops out near
100 kb. The coarse tier draws one node per bubble with the invariant reference
between as backbone nodes, and needed no adapter, glyph or renderer work: a
collapsed bubble already fits the contract (reference span, id, rank). The view
picks the tier by zoom: `RgfaTabixAdapter`'s `coarse: { uri, aboveBpPerPx }`. The
shape matches [SYNTENY_LOD.md](SYNTENY_LOD.md)'s two PIF tiers.

- **Threshold on content, never reference span.** A pure insertion is a
  zero-length bubble (53,293 of HPRC's 130,510), so `end - start` drops the 100 kb+
  insertions that are the pangenome's whole claim. Content is
  `max(reference span, longest allele)`. A zero-span bubble draws 1 bp wide and
  states its size in `cl:i:`.
- **Bubbles do not overlap** (`gfatools bubble` reports top-level only), so one
  sorted walk per chromosome is a complete alternating chain.
- **The node id is the bubble's source segment**, so a tier node joins back to the
  fine tier. Adjacent bubbles share a boundary segment, so sources are distinct
  and sinks are not.
- **`maxRegionBp`** (session prop, default 5 Mb) replaces the bp ceiling as the
  node-count proxy; `maxGraphNodes` counts what came back and is the backstop. A
  tier session raises `maxRegionBp`. `bubbleTier.test.ts` covers a committed chrY
  tier fixture.
- **The chr1 tier is 237 backbone nodes alternating with 237 bubbles.** The
  stretch that looks empty is one 18.7 Mb backbone node (the centromere), not a
  coverage hole.
- **The bubble file plots as a curve with no adapter change**:
  `MinigraphBubbleAdapter` sets `score` to the segment count; only the track type
  changes.
- **`gfatools bubble` returns 0 bubbles on a pggb GFA** (it needs `SN`/`SO`/`SR`).
  `scripts/snarls_to_bubble_bed.py` builds the bubble BED from the `pggb -V`
  `vg deconstruct` VCF (`LV=0` records), then `bubbles_to_tier_bed.py` runs
  unchanged. Use `--min-content 50` there: at 0 every single-base alternative is a
  node and the tier is worse than the fine index.
- **A pggb node id needs qualifying** (`<source>@<refStart>`): pggb folds repeats,
  so a snarl can appear twice on the reference path. `bubbles_to_tier_bed.py`'s
  uniqueness assert found it.
- **The tier is a dud on a small rGFA.** The five-strain E. coli minigraph fine
  index is already 1,508 segments, so a tier buys ~4× where HPRC gets ~1,600×.

## Decisions that look like bugs and are not

- **First visit wins** when a path reaches a segment twice: a node draws as one
  tube at one x. The repeat stays visible as depth.
- **An off-reference segment sits on its own carrier's coordinates**, as in rGFA;
  this is what makes `contributingAssemblies` and the launch-out menu work.
- **Rank is 0 or 1 for a path-derived graph.** rGFA's higher ranks are minigraph's
  build order; more would be invented structure.
- **The reference path is a choice.** Explicit `referencePath` (PanSN sample
  first, then full name), else `loadedRegion.assemblyName`, else the first path in
  the file. An unmatched name falls back rather than dropping to force-directed.
- **The `:start-end` suffix comes off the path name** into the offsets; leaving
  it on gives PanSN a contig no linear view can open, dropping it silently puts
  every extracted subgraph at the origin.
- **The offline walk matches the in-app one on purpose**, so an indexed cut and a
  file cut of one window agree.
- **Extraction is not symmetric across reference paths, and that is biology**, so
  the Reference path picker changing the drawing is expected.

## Ceilings

- **Index size grows with total sequence, not variation** (pggb is ~17 bp per
  segment). A human base-level graph is far past it; index a chromosome at a time
  or browse the SV-resolution minigraph rGFA.
- **The builder's name says nothing about resolution.** `mc/ecoli.gfa.gz` is the
  base-level graph and indexes like pggb; `mc/ecoli.sv.gfa.gz`, from the minigraph
  stage, is the SV-resolution one. A glob over `mc/*.gfa.gz` picks by sort order.
- **The drawable window is node-density-bound**: ~150 nodes legible, ~500 a braid.
- **Force layout does not improve with more nodes.** `bandageAutoScale` targets a
  mean drawn length, so FMMM lays a near-path pangenome out as one thread whose
  length grows and whose 2-D coverage stays ~2%.
- **The force layout is deterministic.** OGDF's `RandomTime` placement ignores
  `randSeed`; the plugin now carries seeded C++ (its `bandage/native` tree)
  with `pnpm test:wasm`, and a `seed` option.
- **A row is a row height, and the y axis is not scaled.** `scaleX` carries zoom,
  `scaleY` is pinned at 1. Every length that mixes axes (chord, tangent, deletion
  bow, mitre normal, arrowhead angle, hover distance) takes **one `AxisScale`**
  (`{scaleX, scaleY}`), since passing scales separately lets a caller default y and
  draw a wrong picture silently; `scaleY === scaleX` is asserted the identity. A
  row layout's horizontal polylines notice none of this; only a deletion's bow
  depends on the ratio (~100× balloon if wrong), so a test needs an arc with
  backbone to bow around. `graph.slang` is not converted (dead until a GPU backend
  exists; `GraphRenderer.ts` says what to change).
- **`odgi degree` is a dud**: over 500 bp windows it has no dynamic range (90% of
  windows within 1.2 units) and correlates with depth at r = 0.78. Don't rebuild
  it as a complexity track; that needs a different statistic.
- **`odgi untangle` is usable** as a general-graph lane (`scripts/untangle_to_bed.py`
  into `LinearMultiRowFeatureDisplay`, rows on strain) with
  `-R target -Q queries -m 1000 -j 0.5 -e 5000 -p`. **`-e` contradicts the removed
  tree's adr-024** (leave `-e` off; bake permissive, filter at runtime): here the
  files feed static figures with no runtime merge and the graph is a near-colinear
  bacterial one, where omitting `-e` returns 174 records for four pairs, no figure.
  Keep the ADR's advice for a human-scale graph or anything a display filters. It
  does not scale to human at that cost.

### A whole-cohort cut, and what decides whether walk rows can draw it

The `walkrows` layout draws every haplotype as a bar on its own bp. Whether that
holds turns on how the route builds its node set, so cut it to find out.
`--context 1000 --snarls` is the cut; `--context 0` is a different question
(every haplotype breaks at every bubble). Time a cut through the plugin's own
`node_modules`: `npx -p @gmod/gbz-base` spends ~37 s resolving the package.

<!-- BEGIN GENERATED MEASUREMENT gbz-cohort-subgraph-cut -->

_Generated by `pnpm autogen` — edit the source, not this block._

| locus                 | span bp | wall s |  GFA MB |  net MB |  nodes | W lines | haplotypes | split walks | complete bars |
| --------------------- | ------: | -----: | ------: | ------: | -----: | ------: | ---------: | ----------: | ------------: |
| ABCA7 VNTR chr19      |     689 |  56.0s | 14.3 MB | 4.59 MB | 13,153 |     474 |        459 |          12 |           444 |
| C4 chr6               |  83,361 |   5.4s | 10.8 MB | 4.19 MB |  4,978 |     464 |        463 |           0 |           462 |
| CFHR3/CFHR1 chr1      |  84,683 |   8.6s | 11.1 MB | 4.32 MB |  6,053 |     464 |        463 |           0 |           463 |
| amylase chr1          | 121,556 |  14.0s | 18.7 MB | 5.96 MB |  6,469 |     934 |        463 |         296 |           168 |
| 1q21.1 inversion chr1 | 153,166 |  18.5s |   38 MB |  7.2 MB | 17,933 |     825 |        453 |         342 |           114 |
| CFH demo window chr1  | 260,000 |  13.8s | 36.8 MB | 5.37 MB | 16,372 |     466 |        463 |           2 |           452 |

<!-- END GENERATED MEASUREMENT gbz-cohort-subgraph-cut -->

The split walks are a property of the cohort cut, not the locus. A `keep`
predicate takes the anchored route, which builds whole walks by construction; it
cannot rescue a walk that genuinely leaves the window (1q21.1 returns 8 of 9
named haplotypes in two pieces because the walk crosses a segmental duplication).
The set a demo names is therefore a data decision: choose it from a census over
every haplotype, not by hand, or the tidy picture is the choosing.

<!-- BEGIN GENERATED MEASUREMENT gbz-keep-set-cut -->

_Generated by `pnpm autogen` — edit the source, not this block._

| haplotype | W lines | walk span bp | GRCh38 span bp | vs GRCh38 |
| --------- | ------: | -----------: | -------------: | --------: |
| GRCh38#0  |       1 |      121,557 |        121,557 |         0 |
| HG01361#1 |       1 |       27,342 |        121,557 |   -94,215 |
| HG00133#2 |       1 |       49,048 |        121,557 |   -72,509 |
| HG01361#2 |       1 |      121,470 |        121,557 |       -87 |
| HG00133#1 |       1 |      121,488 |        121,557 |       -69 |
| NA18608#2 |       1 |      215,595 |        121,557 |    94,038 |
| NA18608#1 |       1 |      309,708 |        121,557 |   188,151 |
| HG00232#1 |       1 |      309,719 |        121,557 |   188,162 |
| HG00232#2 |       1 |      318,428 |        121,557 |   196,871 |

<!-- END GENERATED MEASUREMENT gbz-keep-set-cut -->

**The graph will not group a cohort into structural forms.** `haplotypes:
'distinct'` merges walks through identical nodes, but node identity is the wrong
equivalence for a structural question (one SNP separates two walks with the same
allele). A weight means nothing without its walk length beside it. Group on a
structural tier (the callset's per-window forms, or the bubble tier).

<!-- BEGIN GENERATED MEASUREMENT gbz-distinct-walk-collapse -->

_Generated by `pnpm autogen` — edit the source, not this block._

| locus                | span bp | wall s | distinct forms | walks | top weight | top form steps | median steps |
| -------------------- | ------: | -----: | -------------: | ----: | ---------: | -------------: | -----------: |
| ABCA7 VNTR chr19     |     689 | 126.0s |            465 |   474 |          2 |          3,974 |        3,164 |
| C4 chr6              |  83,361 |  16.6s |            395 |   464 |          9 |          1,574 |        2,331 |
| CFHR3/CFHR1 chr1     |  84,683 |  18.4s |            342 |   464 |         97 |            345 |        3,976 |
| amylase chr1         | 121,556 |  21.2s |            725 |   934 |         20 |            203 |        1,217 |
| CFH demo window chr1 | 260,000 |  45.0s |            466 |   466 |          1 |         10,764 |       10,717 |

<!-- END GENERATED MEASUREMENT gbz-distinct-walk-collapse -->

## Carriage: the one thing rGFA cannot say

`SR` is build order, so an rGFA segment names the assembly that *contributed* it
first, never who else carries it. Two workarounds:

- **`minigraph -cxasm --call`** per assembly, projected by
  `scripts/build_minigraph_paths.sh`; columns 1-14 of its header line are stable.
- **A path GFA**, where every path visiting a segment is stated: the `SM:Z:` tag
  above.
- **A linear lane over the reference draws no rank above 0.** An off-reference
  segment's `SN` names its sample contig, so the index files it under that PanSN
  name; a rank-colouring jexl paints one flat colour on a reference lane.

`--call` traps:

- A bare `.` in the last field is missing data; read as colon-separated it scores
  as a whole-span deletion.
- `*` is an empty path, a deletion only where the bubble has reference span; there
  it is the reference allele. Classify on `delta`; `.` needs its own check.
- The reference row is the pipeline's own check: K12 is `ref` at every bubble. An
  indel there means suspect the join.
- `strand` is orthogonal to the length classes.

### No linearized deletion track — don't rebuild it

Projecting the link index into a link-mark track so a deletion is an arc in an
ordinary LGV was not built:

- **The arcs are anonymous.** A backbone-to-backbone skip has GRCh38 at both ends
  and names no donor, and a linear row reads as carriage (the misreading that
  retired `hprc_allele_inventory`'s sample rows).
- **`wave.vcf.gz` already does it better**: tabix-indexed, explicit ALTs to 65 kb,
  a genotype per haplotype, no plugin.
- **What a projection would uniquely add has no linear encoding** (segment-level
  correspondence, nesting).

A linear projection of a graph looks like a missing feature and is usually a claim
the graph cannot support (same shape as the reroot-MAF reverts).

## Verified facts

- **`ecoli_pggb.maf.bed.gz` carries a row only for a strain that aligns**, so a
  window inside an accessory island reads as a nearly empty lane and every feature
  built from it lists one strain. Check a candidate locus with
  `tabix … | awk -F'\t' '{n=split($6,s,","); print $2"-"$3, n}'`.
- **Tabix over the hosted bytes is not the reader's path.** Demo configs declare
  tracks in config while committed figures declare them in a session spec, so a
  track that resolves by `tabix` can still be one the app never draws. Render it
  the reader's way (`specs/pangenome_cactus.ts` says how above `GRAPH_CONFIG`).
- **HG002's parents are not in the HPRC graph**, so there is no trio.

## The hosted HPRC link index

Facts from `tabix` on `hprc-v2.0-mc-grch38.links.bed.gz`:

- **Haplotype identity is already in the file.** `SN` on a rank>0 segment is the
  PanSN contig of the haplotype that introduced it, and rank maps 1:1 to donor, so
  labelling an off-reference allele needs no W-line projection. Minigraph collapses,
  so the label is the **first** contributor, never everyone carrying it: discovery
  attribution, not a pileup, and it must not be drawn as one.
- **Clean deletions are anonymous** and get a donor only when they carry novel
  sequence, so a per-haplotype row layout can place insertions but not deletions.
- **Chain walking is mostly unnecessary.** One alt-segment id gives the whole
  allele (`refStart` = entry's srcEnd, `refEnd` = exit's tgtStart, `altLen` = the
  segment's length); otherwise pair by `SN` **then** donor offset (`SN` alone is
  ambiguous).
- **Volume is tiny** (tens of records per window), so no density gate. A zero
  alt-to-alt count is a property of the reference-keyed index.
- **The VCF is not symbolic**, so allele length is not what the graph adds.

**The hosted index is dominated by donor-contig index weight**, which every graph
track downloads before cutting (the `fetch 12371ms` in the HPRC graph figures).
A `GRCh38`-only pair (`build_rgfa_tabix.sh` third argument;
`demos/hprc/hprc-v2.0-mc-grch38.ref.*`) returns identical rows for 19× less index,
**but only at `subgraphContext: 0`.** The default is 1 hop, which follows an
allele's interior segments indexed under the donor contig; on the small pair the
expansion finds nothing and the cut silently degrades to context 0 (the two stubs
ending in mid-air in `graph_context.png`). Use the small pair for a segments track
drawn on the reference or a session that sets `subgraphContext: 0`; keep the full
pair for the graph cut and for a track on a contributing assembly. The 12 s fetch
is not free to reclaim this way.

**The bubble file is a locus finder.** `hprc-v2.0-mc-grch38.bubbles.bed.gz` ranks
loci without opening the graph (segment count, path count, shortest and longest
allele, inversion flag on a small, complete set). Scoring on `longest - shortest`
alone returns undrawable pericentromeric satellites; filter to what the view can
draw (delta ≥ 20 kb, ≤ 200 segments, span ≤ 300 kb), and note that `gene` rows in
`ncbiRefSeq.gff.gz` carry `gene_id=`, not `gene_name=`.

## Any donor can be loaded as an assembly, from GenArk

UCSC's GenArk hub for each release 2 assembly names its 2bit sequences by the
GenBank accessions the graph uses, and its `chromAlias.txt` has an `hprcV2` column
spelling the PanSN name. So an assembly entry with `uri: <GenArk>/<GCA>.2bit` and
`refNameAliases: <GenArk>/<GCA>.chromAlias.txt` resolves every node that
haplotype contributed with no mapping: `assemblySampleResolver` matches the PanSN
sample against assembly names and aliases, and `RgfaTabixAdapter`'s lookup is
keyed `sample\tcontig`. Sample+haplotype → GCA is `hprcSamples.json` in jb2hubs.
`pangenome/hprc_haplotype_launch` takes this route.

Minigraph credits an allele to its first contributor, so which haplotype a window
offers is build order. CHM13 is still loaded from UCSC's `hs1` (RefSeq genes,
RepeatMasker); the hg38→hs1 liftOver PIF serves the synteny launch there, and no
per-haplotype alignment is hosted for a GenArk donor.

## Release 2 files nothing here reads yet

Public on `s3://human-pangenomics`:

- **`…hprc-v2.0-mc-grch38.pgbi.vcf.gz`** (3.5 GB, `.tbi` beside it) is snarl-level
  carriage: `AT` per allele, `LV`/`PS` in the snarl tree, 462 haplotypes of `GT`.
  Remote `tabix` over a 70 kb window is seconds. The join to our graph is
  positional, not by id (`ID`/`AT` name base-level integer nodes, not `sNNNNN`).
- **`…WashU_HPRCv2_MEI/all.final.INDEL.unique.gt.combined.hg38.bed`** (10 MB) names
  what an insertion is (`AluY`/`SVA`/`L1…`, phased carriers); bgzip + tabix and it
  is a `FeatureTrack`.
- **`pangenomes/freeze/release2/impg/pafs/all-vs-1/*.merged.paf.gz`**: one PAF per
  haplotype against GRCh38, not range indexed; input for `jbrowse make-pif`.

## Indel glyphs

Two length-aware passes, each an `OverlayCanvas` over whichever backend painted
the blocks plus a second call on the SVG export, neither touching a shader:
`LinearMultiRowFeatureDisplay`'s `lengthField` slot
(`rendering/drawMultiRowIndelGlyphs.ts`) and `LinearMultiSampleVariantDisplay`'s
`showInsertionGlyphs` (`components/drawVariantInsertionGlyphs.ts`). Both borrow
`drawInsertionMarker` from `@jbrowse/alignments-core`; add a glyph consumer there
rather than a display type (`MultiLGVSyntenyDisplay`, ~4,000 lines and three
bespoke shaders, was deleted).

- Draw the bar only where it is wider than the block.
- Keep the cell's own genotype color in the variant pass; the marker supplies
  length only.
- Only cells whose genotype carries the allele widen (`cellCarriesAlt`).
- `featureDeltas.length === featureStarts.length` is the multi-row "slot is set"
  gate, because a zero delta is a legitimate reference-length allele.

## Pairwise alignments unpacked from the GFA

`scripts/gfa_to_pairwise_paf.py` turns a graph's path walks into PAF: two walks
through one node carry identical sequence, so a query haplotype's alignment to any
other path is the nodes the two walks share, in the order the reference visits
them. It needs no HAL, MAF or projection, reads minigraph-cactus (W) and pggb (P),
and any path can be the reference, so a mate-vs-mate alignment is a direct read.
`scripts/build_hprc_multiway_synteny.sh` runs it as `SOURCE=gfa` (default; TAF is
`SOURCE=taf`); both emit the same shape (PanSN names, `cg:Z:` over `=`/`X`/`I`/`D`,
a chrom.sizes per query). `gfa_to_pairwise_paf.test.ts` works an eleven-node graph
by hand. Agreement with the TAF route and the impg PAF is in
`HPRC_RELEASE2.md` §"Unpacking pairwise alignments from the graph".

- **One streaming pass** keeps only node lengths; a W/P line is parsed only for the
  reference or a requested query. The reference's walks form one ranked step list;
  a chain is a run of anchors with monotone ranks (up for the reference's
  orientation, down when flipped) with at most `--max-gap` private bp between
  anchors. A flipped chain emits strand `-` with its CIGAR in the reference's
  forward direction. Private runs become `min(q,r)X` then `I` or `D`.
- **The file is written one chromosome at a time**, so the converter indexes
  reference walks as they come and refuses a late reference walk that visits a node
  a query walked as private, pointing at `--hold-queries`.
- **Contig lengths off the walks are short by the clipped telomere.** Pass the
  assemblies' own `.fai` as `--contig-lengths`.
- **Limits.** `=` is exact by construction; an `X` is graph-induced, and about one
  in ten is actually an equal base. Sequence the graph clipped is absent, so no
  GFA route aligns it where minimap2 or the HAL can. A node the reference visits
  several times is placed at the occurrence continuing the chain: right for a
  tandem repeat walked in order, a guess otherwise.
- **Against halSynteny and minimap2 on E. coli**, the converter covers 3-6% more of
  each genome with half the rows (a chain bridges private runs), every `=` column
  matches the FASTAs, and sampled reference positions map to the same query base as
  minimap2 at 99.7-99.97%.

The reader (`@gmod/gbz-base`) against the converter on the same graph:

<!-- BEGIN GENERATED MEASUREMENT gbz-cigar-vs-gfa-oracle -->

_Generated by `pnpm autogen` — edit the source, not this block._

| K12 window              | records | + records | points agree | points disagree | disagreement                                                                        |
| ----------------------- | ------: | --------: | -----------: | --------------: | ----------------------------------------------------------------------------------- |
| chr:400,000-420,000     |       3 |         2 |          160 |               0 |                                                                                     |
| chr:1,000,000-1,020,000 |       3 |         2 |          112 |               0 |                                                                                     |
| chr:1,500,000-1,520,000 |       3 |         2 |          160 |               0 |                                                                                     |
| chr:2,000,000-2,020,000 |       3 |         2 |          152 |               8 | reader 4131I 2048D where the script writes X: 2,145-3,895 bp apart inside the block |
| chr:2,500,000-2,520,000 |       3 |         2 |          160 |               0 |                                                                                     |
| chr:3,000,000-3,020,000 |       3 |         2 |          160 |               0 |                                                                                     |
| chr:3,500,000-3,520,000 |       3 |         2 |          160 |               0 |                                                                                     |
| chr:4,000,000-4,020,000 |       3 |         2 |          160 |               0 |                                                                                     |
| chr:4,400,000-4,420,000 |       3 |         2 |          160 |               0 |                                                                                     |
| chr:4,600,000-4,620,000 |       3 |         2 |          160 |               0 |                                                                                     |

<!-- END GENERATED MEASUREMENT gbz-cigar-vs-gfa-oracle -->

The reader scores a divergent stretch as I then D where the converter writes X, so
inside such a block the two place a base 2-4 kb apart and outside it they agree to
the base.

**Lane pairs.** The plugin runs no aligner of its own: a lane pair is the
alignment the graph states, through `@gmod/gbz-base`
`pairAlignments({ bases: false })`, and a curated 8-16 haplotype panel was
rejected as not pangenome-ready. A lane stack cuts the window once per adjacent
pair. The graph states 100% of a walk at C4 and CFH but 15-64% at amylase and LPA
KIV-2; at 1q21.1 the graph pairs the carrier with the other duplication copy, not
its allelic position. minimap2 gives a single record there. HPRC assemblies
publish `.fa.gz` with `.fai` and `.gzi`, so windows are range-readable. What
composing through GRCh38 would lose is in
[MULTIWAY_SYNTENY_DISPLAY.md](MULTIWAY_SYNTENY_DISPLAY.md) §1.1.

## Prior art

**The abandoned `gfa-to-tabix` / `GfaTabixAdapter` effort** (removed in
`fa737e4255`, `c72b88d177`, `3b98dbb985`) solved the same problem at HPRC scale.
Its ADRs went with it, so an `adr-0NN` it cites is that tree's numbering
(`git show 3b98dbb985^:agent-docs/architecture-decision-records/`).

- `getSubgraph` was never the failure; `synteny_build` sank it.
- **Its chunked `pos.bed.gz` silently could not carry a path walk** (rows listed the
  set of ordinals per chunk). Do not re-introduce a chunked ordinal index.
- **Whole-contig reverse-complement ("grooming") is real**: flip a walk when >99%
  of the bp it shares with the reference are opposite-orientation (bp-weighted),
  then emit its steps in reverse. Our path walk does none; a real assembly set will
  need it.
- **Chain contraction does not coarsen a dense graph** (`vg mod -u` on HPRC chr20:
  0.95%). Superbubbles (`vg snarls`, BubbleGun) work.
- **What made it heavy was indexing every path.** A subgraph index needs only the
  reference path's coordinates; everything else hangs off segment ids. Start a
  revival there.

**PangyPlot** (Mastromatteo et al. 2025) is the closest prior art: precomputed
`odgi layout` baked into SQLite plus a BubbleGun hierarchy so sub-threshold bubbles
render as one node and the user pops one open (`/pop`). Its `gfabase` range index
over `(refseq_name, refseq_begin, refseq_end)` is what `segs.bed.gz` does with
tabix.

## Operating the graph plugin: two traps

- **`test_data/graphgenomeview/_localdist` was a stale hand-copy.**
  `GRAPH_PLUGIN_LOCAL=1` serves it, so "I rebuilt and it still fails" read an old
  bundle. `website/scripts/specs/graph-fixtures.ts` now copies the plugin's `dist/`
  on every `GRAPH_PLUGIN_LOCAL` run and fails when no build exists.
- **emscripten's `UTF8ArrayToString` cannot decode a long string out of wasm
  memory.** It decodes a view over a resizable `ArrayBuffer`, which browsers refuse
  to `TextDecoder`, only for strings longer than 16 units; shorter ones take a
  manual loop. It read as a data bug (the fine index's `s10274` fine, the tier's
  `bb_GRCh38#0#chr1_0` throws). Patched in the plugin's `build-wasm.sh`.
  **Bisecting on inputs cannot find a bug whose error names a type**: wrap
  `TextDecoder.prototype.decode` and throw the stack (a worker's console does not
  reach the page), and do it on the second round, not the tenth.
