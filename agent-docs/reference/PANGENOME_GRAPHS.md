# Pangenome graphs

How a graph reaches JBrowse, what each format can and cannot say, and the
findings that are expensive to re-derive. Replaces `GENERAL_GFA_HANDOFF.md` and
`PANGENOME_PATHS_HANDOFF.md`, both of whose work shipped.

The view itself is a third-party plugin,
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview` — build and deploy traps are
in the `key_pattern_graphgenomeview_plugin_deploy_and_autofit` memory. User docs
are `website/docs/tutorials/pangenome_graph_view.md`.

## Coordinates are the only real difference between formats

- **rGFA** (minigraph, and the minigraph stage of Minigraph-Cactus) states
  `SN`/`SO`/`SR` per segment.
- **A plain GFA** (pggb, odgi, base-level Minigraph-Cactus) states the same
  thing in path order: walking a path assigns every segment it visits an
  interval on that path's own sequence.

Same information, different encoding. Both are consumed the same way, and there
are two routes in:

| Route                       | Built by                                                                     | What it gives                                                             |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| indexed track (rGFA)        | `scripts/build_rgfa_tabix.sh` (`gfatools gfa2bed -m` + an awk pass over L)   | browse by locus, launch menus, hover sync, segments as a linear track      |
| indexed track (plain GFA)   | `scripts/build_pggb_tabix.sh` → `scripts/pggb_gfa_to_bed.py` (the path walk) | the same, plus a `samples` column rGFA cannot express                      |
| a GFA file                  | `odgi extract` / `vg chunk`, then **Add → Graph genome view**                | one window, no index; the view walks a chosen path in-app (`pathAnchoring.ts`) |

Both builders emit the same pair, and `RgfaTabixAdapter` reconstructs a
synthetic rGFA from them (`formatSubgraph` in `rgfaBed.ts`), which is why
nothing downstream had to learn a second format:

- `<prefix>.segs.bed.gz`: `stableName start end segmentId rank [samples]`
- `<prefix>.links.bed.gz`: one row per L-line **per endpoint**, both endpoints
  stated in full, because a neighbour usually sits on another stable sequence
  where tabix cannot look it up by id

## Decisions that look like bugs and are not

- **First visit wins** when a path reaches a segment twice. A node draws as one
  tube at one x, so the alternative claims reference the segment does not
  occupy. The repeat stays visible as depth (a multiple of the path count).
  Test case: the rRNA operons, where `odgi depth` reaches 10 over the
  five-strain E. coli graph at `chr:4,167,000-4,170,500` and
  `chr:3,942,000-3,946,500`.
- **An off-reference segment sits on its own carrier's coordinates**, the same
  asymmetry rGFA has. This is what makes `contributingAssemblies` and the whole
  launch-out menu work on a graph with no `SN` tags.
- **Rank is 0 or 1 for a path-derived graph.** rGFA's higher ranks are
  minigraph's build order; a path GFA has no equivalent and more would be
  invented structure.
- **The reference path is a choice, not a fact.** Explicit `referencePath` wins
  (PanSN sample first, then full name), else `loadedRegion.assemblyName`, else
  the first path in the file, which is where pggb and odgi leave it. An
  unmatched name falls back rather than dropping to force-directed.
- **The `:start-end` suffix comes off the path name** and into the offsets.
  `odgi extract` writes `K12#1#chr:1004500-1004961`, which is the only statement
  of where the cut sits; leaving it on gives PanSN a contig no linear view can
  open, and dropping it silently puts every extracted subgraph at the origin.
- **The offline walk matches the in-app one on purpose**, so an indexed cut and
  a file cut of the same window agree. Verified: at the `local_subgraph` window
  all 36 intervals from `build_pggb_tabix.sh` match those `gfa_nodes_to_bed.py`
  derives from the `odgi extract` subgraph.

## Ceilings, measured

- **Index size grows with total sequence, not variation.** A pggb graph runs
  ~17 bp/segment: five-strain E. coli is 606k segments and 814k links, ~11 s to
  build, 4.8 MB + 21 MB. A human base-level graph is orders of magnitude past
  that; there, index a chromosome at a time or browse the SV-resolution
  minigraph rGFA instead.
- **The drawable window is node-density-bound, not index-bound.** 1 kb of that
  pggb graph is ~150 nodes and legible; 3 kb is 519 and draws as a braid.
- **Force layout does not get better with more nodes.** Measured over real
  subgraphs, fitted to a 1000 px pane: 60 kb / 108 nodes / mean node 62-77 px /
  ~2% of the canvas inked; 1 Mb / 449 nodes / 15 px / ~2%; 3.5 Mb / 1041 nodes /
  5 px / ~2%. `bandageAutoScale` targets a mean drawn length whatever the count,
  so FMMM lays a near-path pangenome out as one thread whose length grows and
  whose 2-D coverage does not.
- **The force layout is deterministic** as of 2026-07-27. It was not: OGDF's
  `RandomTime` initial placement reseeds from `time(nullptr)` and ignores
  `randSeed`, so the same window drew differently every run and the two
  force-directed figures carried `diffThreshold: 0.1`. The engine's C++ is now
  in the plugin (`src/bandage/native`), seeded, with `pnpm test:wasm` asserting
  it. A `seed` option overrides per call.
- **Sample rows stops aligning past ~12 rows.** Row spacing is 5% of the drawn
  width and the pane caps at 600 px, so a taller-than-wide drawing gets fitted
  to the pane's height and centred, and the backbone no longer sits under the
  linear view's axis.
- **`odgi degree` is a dud**: over 500 bp windows, mean 3.82, max 4.79, no
  dynamic range. It does not make a graph-complexity track.
- **`odgi untangle` is usable** as a general-graph lane:
  `odgi untangle -i graph.og -r K12#1#chr -e 5000 -m 1000 -t 8`, 2m14s, 5,433
  rows, ~1,100 reference-anchored segments per strain with orientation and
  self-coverage. Drops into `LinearMultiRowFeatureDisplay` with `partitionField`
  on the strain. Does not scale to human at that cost. `-e` is
  graph-dependent — few haplotypes need it, many do not (adr-024 says leave it
  off, but that was HPRC chr20 at 90 haplotypes).

## Carriage: the one thing rGFA cannot say

`SR` is build order, so on an rGFA a segment names the assembly that
*contributed* it first, never who else carries it. Both pangenome tutorials warn
about this, and the two workarounds are:

- **`minigraph -cxasm --call`** per assembly, projected to a per-bubble-per-
  sample BED by `scripts/build_minigraph_paths.sh`. Header line is the contract
  (`chrom start end name score strand thickStart thickEnd itemRgb strain class
  delta pathLen refLen alleles nonRef path`); columns 1-14 are stable.
- **a path GFA**, where every path visiting a segment is stated. The walk
  records it in the `samples` column, though nothing reads that column yet (see
  Open).

`--call` traps, each a wrong first attempt:

- a bare `.` in the last field is **missing data**; read as colon-separated it
  yields pathLen 0 and scores as a whole-span deletion.
- `*` is an **empty path**, a deletion only where the bubble has reference span.
  72 of the 601 E. coli bubbles have none, and there `*` is the reference
  allele. Classifying on `delta` handles both; `.` needs its own check.
- **the reference row is the pipeline's own check**: K12 comes out `ref` at all
  601 bubbles. An indel there means suspect the join, not the biology.

## Verified facts, so nobody re-derives them

- `gfatools bubble` reports **top-level bubbles only**, and on the E. coli graph
  they never overlap (0 of 601), which is what makes one flat lane per strain
  complete rather than lossy. Nested variation is the cost, and lives in the
  VCF's `LV`/`PS` snarl fields instead.
- Allele spectrum: 436 biallelic bubbles, 105 with three alleles, 37 with four,
  23 where all five strains differ.
- `strand` is **orthogonal to the length classes**: IAI39's 169 reverse-aligned
  calls split 60 ref / 57 del / 52 ins, in long contiguous runs
  (1,671,139-1,870,074 and nine others). No other strain has any.
- The rGFA-only allele inventory (`build_rgfa_alleles.sh`) agrees with `--call`
  on 747 of 842 alleles; the 95 that differ are compound routes at 69 nested
  bubbles.
- **The five-strain `.og` is on this box**: `~/ecoli_graph5/pggb/*.smooth.final.og`
  with the `.gfa` and `-V` VCF beside it, plus the PanSN fastas in
  `~/ecoli_graph5/`. Do **not** use `~/depth_build/`, the pre-IAI39 four-strain
  run.

## Measured on the hosted HPRC link index

`tabix` on `hprc-v2.0-mc-grch38.links.bed.gz`, two windows from the tutorial's
own loci: C4 (`GRCh38#0#chr6:31,980,000-32,050,000`, 70 kb) and MHC class II
(`32,450,000-32,650,000`, 200 kb).

- **Haplotype identity is already in the file.** `SN` on a rank>0 segment is the
  PanSN contig of the haplotype that introduced it (`HG01433.2#2#CM086511.1`),
  and rank maps 1:1 to donor (MHC: 16 ranks, 16 donors, none shared), so
  labelling an off-reference allele needs no W-line projection. But minigraph
  collapses, so the label is the **first** haplotype to contribute the allele,
  never everyone carrying it: 464 haplotypes in the graph, 15 donors in the MHC
  window, about one allele each. Discovery attribution, not a pileup, and it
  must not be drawn as one.
- **Clean deletions are anonymous.** A backbone-to-backbone skip has GRCh38 at
  both ends, so no `SN` and no donor. One gets a donor only when it carries
  novel sequence (`s462766`, 1 bp, HG01952.1, bridging 31,984,683 to 31,991,051
  — a 6.3 kb deletion). MHC: 8 anonymous deletions against 78 attributed
  alleles, which is why a per-haplotype row layout can place insertions but not
  deletions.
- **Chain walking is mostly unnecessary.** An alternate path's interior links are
  indexed under the donor contig, so a reference query never returns them — but
  72 of 78 MHC alt segments appear in both an off-backbone and an on-backbone
  link, so one segment id gives the whole allele (`refStart` = entry's srcEnd,
  `refEnd` = exit's tgtStart, `altLen` = the segment's own length). The rest
  resolve without the interior too, because entry and exit share `SN` and donor
  coordinates run contiguous across the allele (`s526659` 31,891,267-31,923,687
  then `s526660` 31,923,687-31,924,005, so altLen 32,738). Pair by `SN` **then**
  donor offset; `SN` alone is ambiguous, HG01433.2 contributes 41 entries in
  that one window.
- **Volume is trivial.** MHC 200 kb: 320 unique links, 155 backbone-adjacent, 8
  deletions (mean 605 bp), 78 off the backbone, 79 back onto it, 0 alt-to-alt.
  C4 70 kb: 36 links, 1 deletion, 10 out, 11 back. Tens of records per window,
  so no density gate. That 0 is a property of the reference-keyed index, not of
  the graph.
- **The VCF is not symbolic**, so allele length is not what the graph adds.
  `wave.vcf.gz` at `chr6:32,010,000-32,020,000`: 126 records, **zero** symbolic
  ALTs, explicit ALT strings up to 65,481 bp, genotypes per haplotype. What a
  linearized graph adds over it is segment-level correspondence with the graph
  panel (same ids, same rank colors), the chaining and nesting of an alternate
  path, and working on a bare minigraph rGFA with no `deconstruct` step.

## The hosted index is 95% dead weight (measured 2026-07-30)

Every graph launch downloads both tabix indexes before it can cut anything, and
that fixed cost is what the perf readout reports as `fetch 12371ms` in the
published HPRC graph figures. It is index download, not query:

| file                | data     | `.tbi`   | indexed sequences |
| ------------------- | -------- | -------- | ----------------- |
| `segs.bed.gz`       | 6.7 MB   | 4.42 MB  | 13,717            |
| `links.bed.gz`      | 34.2 MB  | 4.76 MB  | 13,581            |
| reference rows only | 2.5/12.5 | 0.21/0.26 | 195              |

195 of those 13,717 sequences are `GRCh38#*`; the rest are donor contigs.
`getSubgraph` at the default `context: 0` queries **only** the reference
refName, and a reference-keyed link row states both endpoints in full, so the
donor rows are unreachable on the demo path. Rebuilding the pair from
`$1 ~ /^GRCh38/` returns byte-identical rows at
`GRCh38#0#chr6:32,500,000-32,560,000` for **19× less index** (9.18 MB → 0.48
MB). Donor rows are still needed for `context > 0` hops and for a segments
track opened on a contributing assembly (the E. coli case, not HPRC), so this
is a second smaller pair rather than a filter on the only one.

## The bubble file is a locus finder (scanned 2026-07-30)

`hprc-v2.0-mc-grch38.bubbles.bed.gz` is 130,510 bubbles, and it carries enough
per row to rank loci without opening the graph: segment count, path count,
shortest and longest allele, and an **inversion flag that is set on only 246 of
them**. That 246 is small enough to treat as a complete list.

Scoring on `longest - shortest` alone returns pericentromeric and satellite
regions with thousands of segments — a real answer to "where does the graph hold
the most sequence", and undrawable. Filtering to what the view can draw
(delta ≥ 20 kb, ≤ 200 segments, span ≤ 300 kb) leaves 30 candidates, and the
gene names come off the hosted `ncbiRefSeq.gff.gz` (note `gene` rows carry
`gene_id=`, not `gene_name=`). The ones worth knowing:

| locus                          | segs | inv | shortest → longest | genes                    |
| ------------------------------ | ---- | --- | ------------------ | ------------------------ |
| `chr5:70,996,742-71,121,626`   | 27   |     | 0 → 375,610        | GTF2H2, NAIP, OCLNP1     |
| `chr5:69,967,884-70,150,288`   | 50   | yes | 140,991 → 433,090  | SMN2, SERF1B             |
| `chr22:22,674,713-22,919,615`  | 137  |     | 32,072 → 303,712   | IGLL5 (the IGL locus)    |
| `chr14:105,558,722-106,679,859` | 3784 | yes | 106,366 → 2,455,720 | ADAM6, ELK2AP (IGH)     |
| `chr22:18,185,648-19,023,244`  | 2194 | yes | 74,902 → 1,180,034 | DGCR6, FAM230A (LCR22)   |
| `chr1:103,611,080-103,732,636` | 95   | yes | 26,889 → 316,616   | AMY1A, AMY1B, AMY2A      |
| `chr19:42,738,980-42,854,205`  | 146  |     | 0 → 490,126        | PSG3, PSG8               |
| `chr1:248,122,398-248,180,452` | 18   |     | 0 → 247,631        | OR2M2, OR2M5             |
| `chr10:87,233,092-87,429,953`  | 10   | yes | 64,643 → 329,055   | NUTM2A, NUTM2D           |
| `chr16:74,406,294-74,406,329`  | 40   |     | 35 → 239,774       | CLEC18B                  |
| `chr15:28,452,488-28,603,853`  | 98   | yes | 27,815 → 332,579   | GOLGA8G, HERC2P11        |
| `chr1:12,780,118-13,315,943`   | 658  | yes | 61,683 → 1,101,014 | PRAMEF*, HNRNPCL*        |

5q13 is three overlapping mega-bubbles plus an inversion at 27-72 segments
apiece, which is the rare combination of drawable and famous: RefSeq's own
`NAIP` description calls the region "a 500 kb inverted duplication… prone to
rearrangements… difficulty in determining the organization of this genomic
region", and SMN1 copy number is what sets spinal muscular atrophy severity.

## Only two donors can be loaded as assemblies

Of the 464 donor haplotypes in the segment index, exactly **HG002.1, HG002.2 and
CHM13** spell their contigs `chr1`-style; the other 460 use GenBank accessions
(`CM086511.1`). So those are the only contributors a session can open a linear
view on, and the whole outbound launch menu (`nodeLaunchTargets`,
`launchableAssemblies`, the synteny launch) is dead on HPRC purely because the
config loads one assembly.

CHM13 costs nothing to add: UCSC hosts it as `hs1`
(`test_data/hs1/config.json` already has the assembly stanza, a TwoBit off
`hgdownload`), genes are `gbdb/hs1/ncbiRefSeq/ncbiRefSeq.bb`, and
`goldenPath/hg38/liftOver/hg38ToHs1.over.chain.gz` is 2.7 MB and reads through
`ChainAdapter`, which is what a synteny launch out of the graph needs. Pair it
with `assemblyNameToPanSN: { "hs1": "CHM13" }`.

HG002's parents are **not** in the graph (`pgbi.vcf.gz` has HG002 and HG005 but
no HG003/HG004), so there is no trio to show inside the pangenome.

## Release 2 files nothing here reads yet (probed 2026-07-30)

All three are public on `s3://human-pangenomics` and all three answer a question
the sections above record as unanswerable.

- **`submissions/671F0A25-…--hprc_v2.0_mc_grch38_index/hprc-v2.0-mc-grch38.pgbi.vcf.gz`**
  (3.5 GB, `.tbi` published beside it) is the **carriage file this page says does
  not exist**. Snarl-level rather than decomposed: `AT` per allele is its
  traversal through the graph, `LV`/`PS` place it in the snarl tree, and 231
  phased samples give 462 haplotypes of `GT`. Remote `tabix` over the C4 window
  (70 kb) is 1,107 records, 3.2 MB of text, 1.7 s — browsable, unlike its size
  suggests. Records with no `LV` field are the long alleles (`REF` up to 39 kb);
  451 of the 1,107 are `LV=0`. **The join to our graph is positional, not by
  id**: `ID`/`AT` name base-level integer nodes (`>161001867>161004536`), not the
  `sNNNNN` of `sv.gfa`.
- **`submissions/afb0c613-…--WashU_HPRCv2_MEI/all.final.INDEL.unique.gt.combined.hg38.bed`**
  (10 MB, hg38, one file) names what an insertion *is*:
  `chrom start end class score strand INS|DEL carriers intactness`, where class
  is `AluY`/`SVA`/`L1…` and `carriers` is `SAMPLE:1|0,…` phased per haplotype.
  bgzip + tabix and it is a `FeatureTrack`.
- **`pangenomes/freeze/release2/impg/pafs/all-vs-1/*.merged.paf.gz`**, one per
  haplotype against GRCh38 (0.5-0.7 GB gzipped each). The input for a
  per-haplotype linearized synteny stack (`jbrowse make-pif`). Not range
  indexed, so a locus demo means streaming one file per haplotype and filtering
  on the target side.

## Indel glyphs (shipped)

Two length-aware passes, both an `OverlayCanvas` over whichever backend painted
the blocks plus a second call on the SVG export, neither touching a shader:
`LinearMultiRowFeatureDisplay`'s `lengthField` slot
(`rendering/drawMultiRowIndelGlyphs.ts`) and `LinearMultiSampleVariantDisplay`'s
`showInsertionGlyphs` (`components/drawVariantInsertionGlyphs.ts`). Both borrow
`drawInsertionMarker` from `@jbrowse/alignments-core`, which is the seam for
glyph geometry — add a consumer there rather than a display type (`884a126861`
is the counter-example: `MultiLGVSyntenyDisplay`, ~4,000 lines and three bespoke
shaders, deleted).

Rules they encode, each a reverted first attempt:

- **draw the bar only where it is wider than the block** — a same-colored bar
  inside a wide block is invisible overdraw, and the label carries magnitude.
- **keep the cell's own genotype color** in the variant pass; color says which
  allele, the marker only supplies length.
- **only cells whose genotype carries the allele widen** (`cellCarriesAlt`), or
  the marker claims reference haplotypes have the sequence.
- `featureDeltas.length === featureStarts.length` is the multi-row "slot is set"
  gate, because a zero delta is a legitimate reference-length allele.

## Prior art

**The abandoned `gfa-to-tabix` / `GfaTabixAdapter` effort** (removed in
`fa737e4255`, `c72b88d177`, `3b98dbb985`) solved the same problem at HPRC scale:

- `getSubgraph` was never the failure — it matched `vg find` byte-for-byte in
  under 300 ms at ≤100 kb. `synteny_build` sank it, and adr-024 benchmarks the
  replacement (`odgi untangle` on HPRC chr20, ~1 h → 1 m 39 s).
- **its chunked `pos.bed.gz` could not carry a path walk, and silently didn't**:
  rows listed the *set* of segment ordinals per chunk, so haplotype walks came
  out wrong wherever they diverged from the reference. Do not re-introduce a
  chunked ordinal index.
- **whole-contig reverse-complement ("grooming") is real**, with a deterministic
  test: flip a walk when >99% of the bp it shares with the reference are
  opposite-orientation (bp-weighted, so SNP nodes cannot outvote a reversed
  contig), then emit its steps in reverse. Our path walk does none of this; the
  E. coli demo does not need it, a real assembly set will.
- **chain contraction does not coarsen a dense graph**: adr-014 measured
  `vg mod -u` on HPRC chr20 at 0.95% reduction, because at 90 haplotypes almost
  no node has bidirected degree 2. Superbubbles (`vg snarls`, BubbleGun) are the
  primitive that works.
- extraction is **not symmetric across reference paths, and that is biology**
  (adr-015), so the Reference path picker genuinely changing the drawing is
  expected.

**PangyPlot** (Mastromatteo et al. 2025, vendored at `~/src/vendor/pangyplot`)
is the closest published prior art and solved the problem this view still has:
precomputed `odgi layout` SGD baked into SQLite, plus a BubbleGun bubble
hierarchy so sub-threshold bubbles render as one node and the user pops one open
(`/pop`). Their team measured BubbleGun as published at chrY 2 s / 1 GB, chrX
30 s / 11 GB, chr9 ~40 min / 13 GB, chr1 hanging at 15+ GB; the fix is a flat
int64-CSR rewrite. `gfabase` (`src/schema/GFA1.sql`) validates the indexing
shape: a genomic range index over `(refseq_name, refseq_begin, refseq_end)` is
what `segs.bed.gz` does with tabix.

## Open

Each of these is written up with its files, its evidence and a definition of
done in [guides/PANGENOME_GRAPH_NEXT.md](../guides/PANGENOME_GRAPH_NEXT.md).

- **The `samples` column is emitted but not read.** Wiring it (`rgfaBed.ts` →
  an `SM:Z:` tag on the synthetic GFA → `GraphNode.samples`) is what turns
  sample rows from "the first path that walks it" into real carriage.
- **A node carried by several assemblies draws on one row.** Needs the layout to
  emit synthetic per-carrier ids and hit detection to resolve them back.
- **Orientation is recorded but not drawn.** `StableCoordinate.strand` shows in
  the node popup; arrowheads are an edge property in `GeometryBuilder`.
- **A precomputed global `odgi layout`, carried as an `LO:Z:` tag** (adr-028) is
  not built. It is no longer about determinism — FMMM is seeded now, see below —
  but about windows of one graph being laid out consistently with each other.
  The input exists: `~/ecoli_graph5/pggb/*.smooth.final.og.lay.tsv`.
- **Bubble collapse is the one that matters** for scale. Path anchoring gives a
  base-level graph an axis; it does not give it a node budget.
- **HPRC needs no per-haplotype path track after all.** `--call` would need the
  464 assemblies re-mapped, but `pgbi.vcf.gz` (above) already states carriage at
  bubble granularity and is tabix-indexed.
