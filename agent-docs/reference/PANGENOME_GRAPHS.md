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
`IDEAS.md`.

**A plugin store bump moves the figures.** Every config names the plugin list's
`latest/` url on jbrowse.org, and `pnpm check-live-configs` refuses any other.
Graph figures move at the next regen with no commit here; read it with
`pnpm figures:report`. "Unpushed commits" is not "the deployed bundle lacks
them", and bundle hashes are content-addressed and say nothing about lineage
(grep the served file).

## Coordinates are the only real difference between formats

- **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) states
  `SN`/`SO`/`SR` per segment.
- **A plain GFA** (pggb, odgi, vg, base-level Minigraph-Cactus) states the same in
  path order. P and W lines are both read; a P line hides an `odgi extract`
  offset in a `:start-end` name suffix. A graph mixing them (Minigraph-Cactus: P
  reference, W haplotypes) anchors on the P line by file order.

| Route | Built by |
| --- | --- |
| indexed track (rGFA) | `scripts/build_rgfa_tabix.sh` |
| indexed track (plain GFA) | `scripts/build_pggb_tabix.sh` → `pggb_gfa_to_bed.py` |
| coarse tier (any graph) | `scripts/build_bubble_tier.sh` → `bubbles_to_tier_bed.py` |
| a GFA file | `odgi extract` / `vg chunk`, then Add → Graph genome view (`pathAnchoring.ts`) |

Every builder emits `<prefix>.segs.bed.gz` and `<prefix>.links.bed.gz` (one row
per L-line **per endpoint**, both in full, because a neighbour usually sits on
another sequence tabix cannot look up by id). `RgfaTabixAdapter` reconstructs a
synthetic rGFA from them (`formatSubgraph` in `rgfaBed.ts`), so nothing
downstream learned a second format.

## The tag column is the extension point

Column 6 of `segs.bed` is a space-separated list of GFA tags, written verbatim
onto the synthesized S-line; the parser reads arbitrary tags into
`GraphNode.tags`. A producer states something new without touching adapter,
parser or renderer.

- **The tag grammar is checked** (`GFA_TAG` in `rgfaBed.ts`); non-conforming
  fields are dropped.
- **Carriage is per haplotype** (`HG002.1`); keying on the PanSN sample merged a
  diploid sample's haplotypes. `SM:Z:` reaches `GraphNode.samples` through
  `gfaConverter.makeNode`. Precedence is walk-first: `pathAnchoring.anchorNode`
  rebuilds `samples` from path visits when there are any; the tag is the fallback
  for an indexed cut.
- **`segmentSamples` puts `samples` and `carriers` on each linear feature**,
  absent on an rGFA, so a `color` jexl reads `feature.carriers`.

## Level of detail: one node per bubble

The fine tier draws one node per segment, so the drawable window tops out near
100 kb. The coarse tier draws one node per bubble with the invariant reference
between as backbone nodes, and needed no adapter, glyph or renderer work. The
view picks the tier by zoom: `RgfaTabixAdapter`'s `coarse: { uri, aboveBpPerPx }`
(the shape of [SYNTENY_LOD.md](SYNTENY_LOD.md)'s two PIF tiers).

- **Threshold on content, never reference span.** A pure insertion is a
  zero-length bubble, so `end - start` drops the 100 kb+ insertions that are the
  pangenome's whole claim. Content is `max(reference span, longest allele)`.
- **The node id is the bubble's source segment**, so a tier node joins back to the
  fine tier. Adjacent bubbles share a boundary segment, so sources are distinct
  and sinks are not.
- **`maxRegionBp`** (session prop) replaces the bp ceiling as the node-count
  proxy; `maxGraphNodes` is the backstop. A tier session raises `maxRegionBp`.
- **`gfatools bubble` returns 0 bubbles on a pggb GFA** (it needs `SN`/`SO`/`SR`).
  `scripts/snarls_to_bubble_bed.py` builds the bubble BED from the `pggb -V`
  `vg deconstruct` VCF (`LV=0` records), then `bubbles_to_tier_bed.py` runs
  unchanged. Use `--min-content 50` there: at 0 every single-base alternative is
  a node and the tier is worse than the fine index.
- **A pggb node id needs qualifying** (`<source>@<refStart>`): pggb folds
  repeats, so a snarl can appear twice on the reference path.
- **The tier is a dud on a small rGFA**; it pays on HPRC-scale graphs.

## Decisions that look like bugs and are not

- **First visit wins** when a path reaches a segment twice: a node draws as one
  tube at one x. The repeat stays visible as depth.
- **An off-reference segment sits on its own carrier's coordinates**, as in rGFA;
  this is what makes `contributingAssemblies` and the launch-out menu work.
- **Rank is 0 or 1 for a path-derived graph.** rGFA's higher ranks are minigraph's
  build order; more would be invented structure.
- **The reference path is a choice**: explicit `referencePath`, else
  `loadedRegion.assemblyName`, else the first path in the file. An unmatched name
  falls back rather than dropping to force-directed.
- **The `:start-end` suffix comes off the path name** into the offsets; leaving
  it on gives PanSN a contig no linear view can open, dropping it silently puts
  every extracted subgraph at the origin.
- **Extraction is not symmetric across reference paths, and that is biology**, so
  the Reference path picker changing the drawing is expected.

## Ceilings

- **Index size grows with total sequence, not variation.** A human base-level
  graph is far past it; index a chromosome at a time or browse the SV-resolution
  minigraph rGFA.
- **The builder's name says nothing about resolution.** `mc/ecoli.gfa.gz` is
  base-level and indexes like pggb; `mc/ecoli.sv.gfa.gz` is the SV-resolution
  one. A glob over `mc/*.gfa.gz` picks by sort order.
- **Force layout does not improve with more nodes.** `bandageAutoScale` targets a
  mean drawn length, so FMMM lays a near-path pangenome out as one thread whose
  2-D coverage stays ~2%.
- **A row is a row height, and the y axis is not scaled.** Every length that mixes
  axes (chord, tangent, deletion bow, mitre normal, arrowhead angle, hover
  distance) takes **one `AxisScale`** (`{scaleX, scaleY}`), since passing scales
  separately lets a caller default y and draw a wrong picture silently.
- **`odgi degree` is a dud**: over 500 bp windows it has no dynamic range and
  correlates with depth at r = 0.78. Don't rebuild it as a complexity track.
- **`odgi untangle` is usable** as a general-graph lane
  (`scripts/untangle_to_bed.py` into `LinearMultiRowFeatureDisplay`) with
  `-R target -Q queries -m 1000 -j 0.5 -e 5000 -p`. `-e` contradicts the removed
  tree's adr-024 (leave `-e` off; bake permissive, filter at runtime): that holds
  for a human-scale graph or anything a display filters, but a near-colinear
  bacterial graph without `-e` returns 174 records for four pairs.

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
first, never who else carries it. Two workarounds: `minigraph -cxasm --call` per
assembly (`scripts/build_minigraph_paths.sh`), or a path GFA, where every path
visiting a segment is stated (the `SM:Z:` tag above).

`--call` traps:

- A bare `.` in the last field is missing data; read as colon-separated it scores
  as a whole-span deletion.
- `*` is an empty path, a deletion only where the bubble has reference span; there
  it is the reference allele. Classify on `delta`; `.` needs its own check.
- The reference row is the pipeline's own check: K12 is `ref` at every bubble. An
  indel there means suspect the join.

### No linearized deletion track — don't rebuild it

Projecting the link index into a link-mark track so a deletion is an arc in an
ordinary LGV was not built. The arcs are anonymous (a backbone-to-backbone skip
has GRCh38 at both ends and names no donor, and a linear row reads as carriage,
the misreading that retired `hprc_allele_inventory`'s sample rows);
`wave.vcf.gz` already does it better (tabix-indexed, explicit ALTs to 65 kb, a
genotype per haplotype, no plugin); and what a projection would uniquely add has
no linear encoding.

## Verified facts

- **`ecoli_pggb.maf.bed.gz` carries a row only for a strain that aligns**, so a
  window inside an accessory island reads as a nearly empty lane. Check a
  candidate locus with `tabix … | awk -F'\t' '{n=split($6,s,","); print $2"-"$3, n}'`.
- **Tabix over the hosted bytes is not the reader's path.** Demo configs declare
  tracks in config while committed figures declare them in a session spec, so a
  track that resolves by `tabix` can still be one the app never draws. Render it
  the reader's way (`specs/pangenome_cactus.ts` says how above `GRAPH_CONFIG`).
- **HG002's parents are not in the HPRC graph**, so there is no trio.

## The hosted HPRC link index

Facts from `tabix` on `hprc-v2.0-mc-grch38.links.bed.gz`:

- **`SN` on a rank>0 segment is the PanSN contig of the haplotype that introduced
  it**, so labelling an off-reference allele needs no W-line projection.
  Minigraph collapses, so the label is the **first** contributor, never everyone
  carrying it: discovery attribution, not a pileup, and it must not be drawn as one.
- **Clean deletions are anonymous** and get a donor only when they carry novel
  sequence, so a per-haplotype row layout can place insertions but not deletions.
- **One alt-segment id gives the whole allele** (`refStart` = entry's srcEnd,
  `refEnd` = exit's tgtStart, `altLen` = the segment's length); otherwise pair by
  `SN` **then** donor offset (`SN` alone is ambiguous).

**The hosted index is dominated by donor-contig index weight**, which every graph
track downloads before cutting. A `GRCh38`-only pair (`build_rgfa_tabix.sh` third
argument; `demos/hprc/hprc-v2.0-mc-grch38.ref.*`) returns identical rows for far
less index, **but only at `subgraphContext: 0`.** The default is 1 hop, which
follows an allele's interior segments indexed under the donor contig; on the
small pair the expansion finds nothing and the cut silently degrades to context 0
(two stubs ending in mid-air). Use the small pair for a segments track drawn on
the reference or a session that sets `subgraphContext: 0`; keep the full pair for
the graph cut and for a track on a contributing assembly.

**The bubble file is a locus finder.** `hprc-v2.0-mc-grch38.bubbles.bed.gz` ranks
loci without opening the graph. Scoring on `longest - shortest` alone returns
undrawable pericentromeric satellites; filter to what the view can draw. `gene`
rows in `ncbiRefSeq.gff.gz` carry `gene_id=`, not `gene_name=`.

## Any donor can be loaded as an assembly, from GenArk

UCSC's GenArk hub for each release 2 assembly names its 2bit sequences by the
GenBank accessions the graph uses, and its `chromAlias.txt` has an `hprcV2` column
spelling the PanSN name. An assembly entry with `uri: <GenArk>/<GCA>.2bit` and
`refNameAliases: <GenArk>/<GCA>.chromAlias.txt` therefore resolves every node that
haplotype contributed: `assemblySampleResolver` matches the PanSN sample against
assembly names and aliases. Sample+haplotype → GCA is `hprcSamples.json` in
jb2hubs. CHM13 is still loaded from UCSC's `hs1`; no per-haplotype alignment is
hosted for a GenArk donor.

## Release 2 files nothing here reads yet

Public on `s3://human-pangenomics`: the snarl-level carriage VCF
`…hprc-v2.0-mc-grch38.pgbi.vcf.gz` (join to our graph is positional, since
`ID`/`AT` name base-level integer nodes, not `sNNNNN`); the WashU MEI table
`…WashU_HPRCv2_MEI/all.final.INDEL.unique.gt.combined.hg38.bed` (bgzip + tabix
makes a `FeatureTrack` naming what an insertion is); and one PAF per haplotype
against GRCh38 under `pangenomes/freeze/release2/impg/pafs/all-vs-1/`, not range
indexed, as input for `jbrowse make-pif`.

## Indel glyphs

Two length-aware passes, each an `OverlayCanvas` over whichever backend painted
the blocks plus a second call on the SVG export, neither touching a shader:
`LinearMultiRowFeatureDisplay`'s `lengthField` slot
(`rendering/drawMultiRowIndelGlyphs.ts`) and `LinearMultiSampleVariantDisplay`'s
`showInsertionGlyphs` (`components/drawVariantInsertionGlyphs.ts`). Both borrow
`drawInsertionMarker` from `@jbrowse/alignments-core`; add a glyph consumer there
rather than a display type (`MultiLGVSyntenyDisplay`, ~4,000 lines and three
bespoke shaders, was deleted).

- Only cells whose genotype carries the allele widen (`cellCarriesAlt`); the cell
  keeps its own genotype color and the marker supplies length only.
- `featureDeltas.length === featureStarts.length` is the multi-row "slot is set"
  gate, because a zero delta is a legitimate reference-length allele.

## Pairwise alignments unpacked from the GFA

`scripts/gfa_to_pairwise_paf.py` turns a graph's path walks into PAF: two walks
through one node carry identical sequence, so a query haplotype's alignment to any
other path is the nodes the two walks share, in the order the reference visits
them. It reads minigraph-cactus (W) and pggb (P), and any path can be the
reference. `scripts/build_hprc_multiway_synteny.sh` runs it as `SOURCE=gfa`
(default; TAF is `SOURCE=taf`); both emit the same shape.
`gfa_to_pairwise_paf.test.ts` works an eleven-node graph by hand. Agreement with
the TAF route and the impg PAF is in `HPRC_RELEASE2.md` §"Unpacking pairwise
alignments from the graph".

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
rejected as not pangenome-ready. The graph states 100% of a walk at C4 and CFH
but far less at amylase and LPA KIV-2; at 1q21.1 the graph pairs the carrier with
the other duplication copy, not its allelic position. What composing through
GRCh38 would lose is in
[MULTIWAY_SYNTENY_DISPLAY.md](MULTIWAY_SYNTENY_DISPLAY.md) §"Where things live".

## Prior art

**The abandoned `gfa-to-tabix` / `GfaTabixAdapter` effort** (removed in
`fa737e4255`, `c72b88d177`, `3b98dbb985`) solved the same problem at HPRC scale.
Its ADRs went with it, so an `adr-0NN` it cites is that tree's numbering
(`git show 3b98dbb985^:agent-docs/architecture-decision-records/`).

- **Its chunked `pos.bed.gz` silently could not carry a path walk.** Do not
  re-introduce a chunked ordinal index.
- **Whole-contig reverse-complement ("grooming") is real**: flip a walk when >99%
  of the bp it shares with the reference are opposite-orientation (bp-weighted),
  then emit its steps in reverse. Our path walk does none; a real assembly set will
  need it.
- **Chain contraction does not coarsen a dense graph** (`vg mod -u`). Superbubbles
  (`vg snarls`, BubbleGun) work.
- **What made it heavy was indexing every path.** A subgraph index needs only the
  reference path's coordinates; start a revival there.

## Operating the graph plugin: two traps

- **`test_data/graphgenomeview/_localdist` was a stale hand-copy.**
  `GRAPH_PLUGIN_LOCAL=1` serves it, so "I rebuilt and it still fails" read an old
  bundle. `website/scripts/specs/graph-fixtures.ts` now copies the plugin's `dist/`
  on every `GRAPH_PLUGIN_LOCAL` run and fails when no build exists.
- **emscripten's `UTF8ArrayToString` cannot decode a long string out of wasm
  memory** (a view over a resizable `ArrayBuffer`, which browsers refuse to
  `TextDecoder`, only for strings longer than 16 units). It read as a data bug.
  Patched in the plugin's `build-wasm.sh`. **Bisecting on inputs cannot find a bug
  whose error names a type**: wrap `TextDecoder.prototype.decode` and throw the
  stack (a worker's console does not reach the page).
