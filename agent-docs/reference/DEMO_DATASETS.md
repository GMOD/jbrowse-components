---
name: demo-datasets
description: Which demo data has limits that render as bugs, which datasets were rejected, and which format traps bite a new demo build? Read before swapping a dataset.
audience: internal
kind: dataset
---

# Demo datasets

Each demo's `README.txt` or build script holds provenance, counts and sizes.
Hosting and upload mechanics are in [HOSTING.md](HOSTING.md). This page keeps the
limits that render as bugs, the loci and datasets already decided, and the
format traps.

## Limits that look like bugs

- **Most `test_data/volvox` fixtures are ctgA-only** (`volvox-sorted.bam`,
  `volvox.bw`, `volvox_sine.bw`, `volvox_microarray*.bw`). Both contigs:
  `posneg_rw{1..4}.bw`, `v{1..4}.cram.bw`. A ctgB view draws genes and nothing
  else, which is correct rendering of absent data and indistinguishable from a
  failed fetch.
- **A sliced BAM (`*.demo_slices.bam`, `scripts/build_demo_slices.sh`) records its
  provenance** in an `@PG` line: `samtools view -H <slice>.bam | grep -oE 'CL:samtools
  view -b -o .*'`. Cut each region wider than every window that displays its reads:
  depth decays smoothly at a slice edge, looks like coverage, and nothing marks it.
  A sliced track cannot back a genome-wide `jb2export batch`: most junctions render
  as empty pileups and the run reports success. Point it at the full BAM.
- **A `-` strand chain stores query coordinates in reverse-complement space**
  (forward = `qSize - qEnd .. qSize - qStart`). Read as forward they put the HG002
  inversion 127 Mb away and look like a translocation. That track is a
  self-alignment, so both `assemblyNames` are `hg002v1.2`.
- **A `plink --maf` floor decides what an LD panel can say.** Both Anopheles 2La
  panels use `--maf 0.2`, and Gabon's inverted arrangement is 5 of 138 haplotypes,
  so its tag variants sit below the floor. An empty panel speaks only to common
  variation. The LD status bar names only the pair window, so never gate a
  screenshot on a "… variants shown" text.
## Datasets tried and rejected

- **DGRP In(2L)t for an LD triangle.** An inversion suppresses recombination only
  between arrangements; the LD heatmap wants local kb-scale haplotype blocks.
- **One sample showing an inversion in both short and long reads.** HG02768 is not
  in the 1000G ONT set. Best loadable ONT source is IGSR 1KG_ONT_VIENNA.
- **The GenArk viral hub for Nextstrain demos.** Its RefSeq strains do not match the
  Nextstrain build references, except measles NC_001498.
- **COLO829 for canonical imprinting.** LOH at every DMR; the methylation tutorial
  uses HG002 germline ONT instead.
- **Teaching `NcbiSequenceReportAliasAdapter` `*_assembly_report.txt`** was tried and
  reverted.

## Where things live

- **Querying a tumour CRAM without downloading it**: the header `UR` is a path on
  the submitter's cluster, so skip SEQ, the only field needing the reference:
  `samtools view --input-fmt-option required_fields=0x87F -F 1540 <url> <region>`.
- **ASW trio ancestry** is deliberately not an AMR trio: 1000G has no unadmixed
  Native American reference.
## Where a new demo's annotation comes from

**Default to `datasets download genome accession <acc> --include gff3,protein`**
(`build_grape_peach_cacao_synteny.sh` is the multi-genome version). One accession
names one assembly, and the same CLI emits the `seq-report` an INSDC-accession
assembly needs for aliases.


## Format gotchas

- **Don't hand-write a refNameAliases file for an INSDC-accession assembly.**
  `datasets download genome accession <GCA> --include seq-report`, then `dataformat
  tsv genome-seq --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name`.
- **UCSC GenArk hubs are keyed on RefSeq accessions**, so a hub track drops into a
  config for the same assembly with no aliasing. Check
  `hgdownload.soe.ucsc.edu/hubs/GCF/...` before hosting your own.
- **Don't take a repeat's identity from the Ensembl REST API**: it returned the
  right interval under a chr4 id on chr1. Use the assembly's own annotation.

## "Make this figure on better data" is often a claim the data cannot make

Count before hunting for new data, and again before deleting a figure.
`multisv_rhd_dosage` wanted arcs over a deletion that produces one spanning pair
(NAHR between identical repeats aligns collinearly), and
`alignments/strand_split_coverage` already had the strandedness in frame. Both ship a
`website/scripts/` script that prints the numbers.
