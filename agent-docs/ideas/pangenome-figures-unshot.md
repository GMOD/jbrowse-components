---
name: pangenome-figures-unshot
description: chrM as a whole-graph file, SMN1/SMN2, and carriage shown at the graph's own granularity.
---

# Pangenome graph figures not yet shot

In the order worth shooting them. Every file, locus and measured cost is in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) — the bubble scan,
the release-2 files, and why CHM13 is the only donor worth loading.

- **The mitochondrial pangenome, force-directed — built and verified, needs two
  files hosted.** HPRC release 2's pggb build ships per chromosome and **chrM is
  78 kb compressed** against 2.5–7.4 GB for every autosome, so it is the one human
  graph small enough to hand the view as a file: no index, no launch, no region,
  and base-level rather than SV-resolution. The whole graph is 4,749 nodes / 6,540
  edges / **234 haplotype paths** over 16.6 kb, path-anchored on `GRCh38#0#chrM`,
  node depth 1–234 (so `depth` colouring means "how many haplotypes carry this"),
  FMMM laying it out in 1.6 s at aspect 1.07.

  **But the whole graph draws as a rope** — 4,749 nodes over a 900px pane is
  0.19px each against a fixed node thickness. The legible cut is a narrow window
  with all 234 haplotypes, and two are ready: `chrM:8,200-8,400` (**61 nodes / 84
  edges / 234 paths**, the 9 bp COII/tRNA-Lys deletion region, a handful of
  bubbles at 15px per node — this is the one to shoot) and `chrM:16,024-16,400`
  (351 nodes, HVS-I, the most-sequenced stretch of human DNA in population
  genetics; denser, still speckled).

  Recipe: fetch
  `pangenomes/freeze/release2/pggb/gfas/by-chromosome/20251014_hprc25272.p98-k311.chrM.gfa.zst`,
  `zstd -d`, `odgi build -g`, then `odgi extract -i chrM.og -o w.og -r
  'GRCh38#0#chrM:8200-8400' -c 0` and `odgi view -i w.og -g` — 67 kb and 305 kb of
  GFA respectively. Pair with `bubbleSpread: 'open'` and `colorScheme: 'depth'`;
  the spec is declarative (`gfaLocation`) with no menu-driving. Worth stating in
  the tutorial too: the 12 most divergent haplotypes are pickable with `odgi
  similarity` plus a farthest-point walk, and the first pick after GRCh38 is
  HG03270 at 7.8% dissimilarity — the deep African split, which is the right
  answer.
- **Shoot 5q13 (SMN1/SMN2), not another MHC window.** Three overlapping
  mega-bubbles at 27–72 segments each plus an inversion, in a region RefSeq itself
  describes as impossible to organize, where copy number sets spinal muscular
  atrophy severity and short reads cannot count it. The graph, the bubble lane and
  a carriage matrix all have something different to say about the same 300 kb. The
  locus table in `pangenome_hprc.md` is five loci picked off a list; this one was
  picked by scanning the bubble file, which is the method worth writing down.
- **Draw orientation.** 246 of 130,510 bubbles carry the inversion flag and
  `StableCoordinate.strand` reaches the node popup while nothing draws it — so the
  one structural event a graph shows better than any linear view is invisible in
  ours. Arrowheads or a reversed-node treatment makes AMY1, 15q13/HERC2, 10q23 and
  LCR22 read as inversions on sight. Same missing data as the `computeEdgeCurves`
  reverse-complement bug, so the two land together.
- **"240 kb that GRCh38 does not have."** `chr16:74,406,294-74,406,329` is a 35 bp
  anchor with a 239,774 bp allele; `chr1:248,122,398-248,180,452` is 18 segments
  and a clean 0 → 247,631 presence/absence over an olfactory-receptor cluster. The
  pangenome's whole claim, in one window, at a segment count that draws instantly.
- **Carriage at the graph's own granularity** (`pgbi.vcf.gz`). The HPRC tutorial
  ends "carriage remains the callset's job" and hands off to `wave.vcf.gz`, whose
  decomposition is finer than the graph's alleles. This file is one record per
  snarl with 462 haplotypes of `GT`, so a matrix beside the graph has one column
  per bubble — which is what makes `hprc_graph_vs_callset` legible instead of two
  pictures at different grains. `LV=0` filters to the same top-level bubbles the
  hosted bubble track holds. Joining its `AF` onto the allele inventory would let
  both panels colour by allele frequency, a statement nothing else in JBrowse can
  make: this 100 kb insertion is carried by 41% of 462 haplotypes, that one by
  0.2%.
- **What the insertion is** (the WashU MEI BED, 10 MB, one file, hg38). The graph
  says 315 bp of novel sequence attaches here; this says `AluY`, intact, and lists
  the haplotypes carrying it. Cheapest of the data adds, and it contributes
  information no projection of the graph can.
- **Linearized multiway synteny of several haplotypes** (impg `all-vs-1` PAFs) —
  the open verdict on `hprc_c4_subgraph`. The alignments exist per haplotype
  against GRCh38 and `make-pif` indexes them; gene annotation per haplotype is the
  unresolved half (release 1 has CAT GENCODE38, release 2 needs checking or a
  liftoff), so scope it at r1 samples that are also in r2 if the annotation search
  comes up empty.
- **A chromosome-scale band, config only.** A `LinearWiggleDisplay` on the
  existing bubble track gives the overview band with no new rendering code
  (`MinigraphBubbleAdapter` already sets `score: segmentCount`), and it is still
  unbuilt. It is the one thing that makes the graph navigable at chromosome scale,
  and the next figure after it is a whole-chr6 variability profile with the MHC as
  a visible spike.
- **Still open from the CHM13 figure:** highlight-into-the-donor view. The
  synteny launch has its figure now, `pangenome/hprc_synteny_launch`, off
  `test_data/graphgenomeview/hprc_hs1.json` (hg38 and hs1 alone: on `hprc.json`
  a loaded CFHR haplotype also contributes at the CHM13 window, so the launch
  there opens three panels and the liftOver aligns one of them to nothing), and
  the GenArk route in `pangenome_hprc.md` makes any of the 464 haplotypes an
  openable donor, with `pangenome/hprc_haplotype_launch` and the
  `pangenome/hprc_out_to_haplotype` tour as the worked example.
