---
name: pangenome-figures-unshot
description: SMN1/SMN2, drawn orientation, the 240 kb GRCh38 lacks, allele frequency on the graph-versus-callset figure, and the other graph figures still unshot.
---

# Pangenome graph figures not yet shot

In the order worth shooting them. Every file, locus and measured cost is in
[reference/PANGENOME_GRAPHS.md](../../reference/PANGENOME_GRAPHS.md) — the bubble scan,
the release-2 files, and why CHM13 is the only donor worth loading.

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
- **Allele frequency on the graph-versus-callset figure.** `pgbi.vcf.gz` is hosted
  and `pangenome_hprc_part2.md` teaches it; what `hprc_graph_vs_callset`
  (`website/scripts/specs/graph-hprc.ts`) still lacks is its `AF` joined onto the
  allele inventory, so both panels colour by frequency: this 100 kb insertion is
  carried by 41% of 462 haplotypes, that one by 0.2%.
- **What the insertion is** (the WashU MEI BED, 10 MB, one file, hg38). The graph
  says 315 bp of novel sequence attaches here; this says `AluY`, intact, and lists
  the haplotypes carrying it. Cheapest of the data adds, and it contributes
  information no projection of the graph can.
- **Linearized multiway synteny of several haplotypes** (impg `all-vs-1` PAFs) —
  what a C4 figure would need to show copy number per haplotype. The alignments exist per haplotype
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
  synteny launch stays prose on part 3, since its figure repeated
  `pangenome/hprc_chm13_allele` above a liftOver ribbon (a figure of it needs
  hg38 and hs1 alone: on `hprc.json` a loaded CFHR haplotype also contributes at
  the CHM13 window, so the launch there opens three panels), and the GenArk route in `pangenome_hprc.md` makes any of the 464 haplotypes an
  openable donor, with `pangenome/hprc_haplotype_launch` and the
  `pangenome/hprc_out_to_haplotype` tour as the worked example.
