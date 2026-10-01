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
| `v2.0/…/hprc-v2.0-mc-grch38.full.taf.gz` + `.tai` | yes, `BgzipTaffyAdapter` |
| `v2.1/…/hprc-v2.1-mc-grch38.full.maf.gz` + `.tai` | yes, `BgzipMafAdapter`; the tutorial's file |
| `sv.gfa` (minigraph rGFA) | yes, graph view plugin |
| `wave.vcf.gz` | yes, genotype matrix |
| `hprc25272.aln.paf.gz` and the per-target `impg/pafs/all-vs-1/` split | sparse all-vs-all and unsorted (below) |
| `hprc465vsgrch38.aln.paf.gz` | yes, but a star (below) |
| per-chromosome pggb `.gfa.zst` | no (below) |
| impg TPA | no reader |

- v2.0 publishes the alignment as TAF and v2.1 as MAF, never both, and v2.1 is a
  re-run whose content differs (its README, `…/minigraph-cactus/v2.1/README`,
  lists the changes). Check it before treating a v2.0 oddity as a JBrowse bug. At
  C4, a copy-number variable locus, no build is the single correct projection.
## Measured findings

**impg's PAF output is projections, not compositions.** `impg query -x -o paf`
anchors on the sequence queried, so on the vs-GRCh38 star a query returned zero
rows pairing two non-reference haplotypes. A-vs-B through impg means `-o fasta`
and realigning, or `-o maf`/`-o gfa`.

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
`gfa_to_pairwise_paf.py` on a `--format gfa` window (pairs it as `X`) for a
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
## What the `LV==0` filter costs

The wave VCF is vcfwave-decomposed, so the tutorial teaches `LV==0` to keep the
top-level record and not paint one event at two positions. The cost is a span
collapsing onto a column: a parent sits at one position while its children spread
over its span, so a window can lose all its records to a parent drawn elsewhere
(CYP21A1P/TNXA, `chr6:32,000,000-32,020,000`, holds records and none with
`LV==0`). That is why `maf_hprc_pangenome`'s callset lane runs unfiltered. A blank
column under `LV==0` is a statement about the snarl tree.

