---
name: hprc-release2
description: What does HPRC release 2 publish, which artifacts open in JBrowse, and which measured traps (impg projections, star PAFs, tab-separated MAF, taffy limits) should not be re-derived? Read before touching the pangenome MAF or synteny path.
audience: internal
kind: dataset
---

# HPRC release 2 in JBrowse

The alignment and MAF side of the HPRC data. The graph view's own queue lives in
the graph plugin's repo (`jbrowse-plugin-graphgenomeviewer`, its `IDEAS.md`).

## What opens

| artifact | opens? |
| --- | --- |
| `v2.1/…/hprc-v2.1-mc-grch38.full.maf.gz` + `.tai` | yes, `BgzipMafAdapter`; the tutorial's file |
| `sv.gfa` (minigraph rGFA) | yes, graph view plugin |
| `pgbi.vcf.gz` | yes, genotype matrix; the tutorial's file and the portal's variants launch (below) |
| `wave.vcf.gz` | yes, genotype matrix; a track in jb2hubs' hg38 and hs1 configs (below) |
| `hprc25272.aln.paf.gz` and the per-target `impg/pafs/all-vs-1/` split | sparse all-vs-all and unsorted (below) |
| `hprc465vsgrch38.aln.paf.gz` | yes, but a star (below) |
| per-chromosome pggb `.gfa.zst` | no (below) |
| impg TPA | not in JBrowse; impg 0.5.0 queries it with the release's AGC (below) |

- Read v2.1. v2.0 is an earlier Minigraph-Cactus run, not a repackaging:
  `…/minigraph-cactus/v2.1/README` lists fewer underalignments, patched
  assemblies and a missing-genotypes fix in `wave.vcf.gz`. Its alignment ships
  only as a TAF, which reads in fewer bytes and draws a different build beside
  2.1's graph and callsets. Sites move between the two: the CFHR3/CFHR1 deletion
  is `chr1:196753075` in the 2.0 wave VCF and `196758726` in 2.1's. At C4, a
  copy-number variable locus, no build is the single correct projection.

## Measured findings

**impg's PAF output is projections, not compositions.** `impg query -x -o paf`
anchors on the sequence queried, so on the vs-GRCh38 star a query returned zero
rows pairing two non-reference haplotypes. A-vs-B through impg means `-o fasta`
and realigning, or `-o maf`/`-o gfa`.

**The v2.1 MAF gives a haplotype one row per copy.** Cactus writes every copy
of a duplicated segment into the block, so at amylase (chr1:103.6–103.8 Mb)
292 of 332 blocks repeat a haplotype, up to eight times. Redundant unplaced
contigs repeat a few at CFH, LPA, chr22 and chrX. Blocks never overlap on
GRCh38. The MAF adapters drew the last copy alone until each later copy became
its own row (`sampleCopies.ts`); in file order a copy stays on one row from
block to block 99.4% of the time at amylase.

**impg's TPA route costs too much to teach on HPRC.** Measured 2026-10-04 on
ada with impg 0.5.0, the TPAs (23.3 GiB) and `HPRC_r2_assemblies_0.6.1.agc`
(3.3 GB, the v1.0.1 assemblies the TPAs name):

- `impg index --index-mode per-file`: 6 min, 10.5 GB peak. Passing `-i` forces
  one index file and peaks at 119 GB.
- `-o bed` at a 400 kb GRCh38 window: 11 s, every haplotype, since every one
  aligns to GRCh38 directly. `-x` adds the paralogous copy at a segmental
  duplication: 327 haplotypes gain a second row at CFH.
- `-o gfa` over 200 kb: 14 min, 23.5 GB. impg realigns the intervals with
  FastGA and builds the graph with pggb, and the result agrees with the
  Minigraph-Cactus graph at the CFHR3/CFHR1 deletion. Its 18.6k nodes crash
  bandage-figure's force layout; the ordered layout draws.
- `-o maf` refuses windows over 10 kb, and 10 kb took 14 GB. impg writes rows in
  arbitrary order, so `taffy sort -r` has to put GRCh38 first before
  `taffy index`.

A tutorial would spend that to draw a window the gbz-base lanes and the shipped
MAF already draw, so the HPRC page was declined. A short section in
`pangenome_prepare_graph`, on a non-human set with no graph, is the fit left.

**`hprc465vsgrch38.aln.paf.gz` is a pure star.** Every row targets GRCh38, so a
band between two non-reference assemblies is empty by construction. Both
all-vs-all adapters throw `noSuchPairError` rather than drawing an empty band.

**`hprc25272.aln.paf.gz` does not hold every pair either.** An unordered pair has
a direct CIGAR about one time in five, so `build_amylase_haplotypes.sh` aligns
each pair with minimap2. The per-target files are BGZF but not sorted by target
position, so an index alone cannot make them range-requestable.

**A composition tool for this was built and deleted** (`jbrowse transitive-paf`,
`a2858d0c86` → `79080af254`). Do not rebuild it: three stacked rows need only two
bands (order the reference between them), and beyond that a pangenome is a
multiple alignment.

**The per-chromosome pggb graphs do not fit in memory.** `pggb_gfa_to_bed.py`
holds every segment, link and path step at once, so chrY, the smallest, exhausted
a 30 GB machine. For human, use `odgi extract` on a window or the minigraph rGFA.

**taffy dies on a byte-cut slice.** A truncated last MAF block trips
`maf_read_block`'s assertion, and a headerless mid-file TAF range segfaults. Cut
at a block boundary.

**`maf2bed` needs v0.6.0 or newer for `--summary`.** v0.5.1 ignored the unknown
flag, exited 0 and wrote nothing.

## Unpacking pairwise alignments from the graph

**A haplotype pair needs no 63 GB download.** `gbz-base-query` with
`--haplotype-index` and `--stack` fetches one window and prints each row against
the next as PAF (`scripts/build_graph_haplotype_stack.sh`). Do not use the
reader's `--cigar` (sizes the stretch between shared nodes as one `M`) or
[`gfa_to_pairwise_paf.py`](https://github.com/cmdcolin/gfa-to-pairwise-paf) on a `--format gfa` window (pairs it as `X`) for a
haplotype pair: neither compares bases.

**The tier is a separate config, not switched on for `hprc_maf.json`.** The
summary swaps on span (`coarseTierPastThreshold` is `aboveForceLoadFloor`), while
the question it stands in for is cost, so the tutorial's 83 kb C4 figure would
silently lose its per-haplotype base rows to presence bands. A cost-based swap is
a design question, since the deciding estimate is the detail tier's, which
`byteGateAdapterConfig` points away from once the tier is on (`gateMeasuresCoarse`).
[MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md) §"Fetch dominates at 470-way"
predicted this gap.

Traps in the summary build, none specific to HPRC:

- **`taffy view -r` fails silently on a range past the contig's end**: stderr
  message, empty MAF, exit 0, so a harness testing `[ -s file ]` passes a summary
  holding only its header (one build lost 93 of 195 contigs). A per-chromosome
  table catches it; a genome-wide total hides it.

## Which VCF to read the graph against

The release builds in one order: `minigraph -cxggs` makes the SV-level `sv.gfa`,
Cactus aligns every assembly against it (`full.hal`), and HPRC exports that
alignment as the base-level graph `vg deconstruct -P GRCh38` writes the VCFs
from and as the MAF. So the MAF is the same alignment as the VCFs, not an
independent check of them, and the drawn `sv.gfa` came first.

Four VCFs sit beside each build. Measured at MHC class II, C4 and HP (2026-10-02):

- **`pgbi.vcf.gz`** (PanGenie's bi-allelic input) splits each snarl into one
  record per whole allele. The HLA-DRB5 allele is four records (REF 12,014 bp,
  ALTs 1,768-1,769 bp, 46 of 462 haplotypes); the C4 module deletion is one
  (REF 32,738 bp at chr6:31,996,629, 154 haplotypes). `alleleLength>=50` alone
  matches the graph's tier, which is why `pangenome_hprc` reads this file.
- **`wave.vcf.gz`** decomposes each allele into its smallest differences, and
  nests records under a parent snarl that often has no record of its own. In
  the portal's MHC window (chr6:32,510,000-32,600,000) 181 of its 224 records of
  50 bp or more are `LV=1`, all inside 32,512,256-32,573,523, so `LV==0` blanks
  HLA-DRB5 and leaves HLA-DRB1 its records. At HP (chr16:72,040,000-72,090,000)
  it keeps 1 of 11 and drops the 1.7 kb deletion in 190 of 461 haplotypes. At
  C4 every record is `LV=0` and the filter drops nothing. wave lists CHM13, so
  464 haplotypes, and leaves some uncalled at nested records (336 called, at
  worst, at MHC).
- **`vcf.gz`** (vcfbub, top level) has no records at all across
  chr6:32,486,309-32,575,299, so it cannot stand in.
- **`pgin.vcf.gz`** matches `vcf.gz` record for record at MHC.

`pgbi` records carry only `AT` and `ID` in INFO, so an allele frequency comes
from the genotypes, not from `AF`.
