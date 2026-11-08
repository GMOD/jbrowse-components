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
- **A GenArk hub's `*_assembly_report.txt` in place of its chromAlias.**
  `NcbiSequenceReportAliasAdapter` reads it, for the sequence roles
  `chromosomes` needs, but the hub's copy usually has `na` UCSC names, so the
  `chr1` aliases its chromAlias carried are lost.

## Where things live

- **Querying a tumour CRAM without downloading it**: the header `UR` is a path on
  the submitter's cluster, so skip SEQ, the only field needing the reference:
  `samtools view --input-fmt-option required_fields=0x87F -F 1540 <url> <region>`.
- **ASW trio ancestry** is deliberately not an AMR trio: 1000G has no unadmixed
  Native American reference.
- **1000 Genomes 30x CRAMs stream from S3**:
  `https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/<ERR>/<sample>.final.cram`
  plus `.crai`, with range requests and CORS `*`; map sample to ERR through the
  `*.sequence.index` files. A `CramAdapter` with only `uri` works on the hg38
  hub. Genotypes come from EBI's `20220422_3202_phased_SNV_INDEL_SV` panel,
  since the S3 copy of the 2020 release is 0-byte keys.
- **FinnGen R12 slices for Manhattan tracks** live under
  `jbrowse.org/demos/<topic>/` (`apoe/finngen_r12_ad_apoe.bed.gz`,
  `factor_v/finngen_r12_vte_f5.bed.gz`). FinnGen's bucket has no CORS, Pan-UKB
  is hg19, and GWAS Catalog harmonised files lack tabix, so a new locus gets its
  own slice: `tabix <R12 url> <range>`, rewritten to `#chrom chromStart chromEnd
  name neg_log_pvalue beta nearest_genes` (score is `mlogp`), then `bgzip`,
  `tabix -C -p bed`, and `scripts/deploy-demo.sh <dir> <topic>` with
  `DEPLOY_DEMO_ALLOW_UNTRACKED=1`. Run the remote `tabix` from a scratch dir,
  since it leaves the remote `.tbi` in cwd.
- **A third-party URL in `demos/*/config.json` has nothing watching it.** The
  same URL in `website/scripts/specs/` fails a figure in the weekly sweep; in a
  hosted demo config it degrades to broken tracks silently. Name the gate that
  catches a break before proposing a demo on dated upstream paths (C-GIAB's
  callsets live in dated FTP directories, and that contact sheet was declined).
- **HG002 per-haplotype methylation** is ONT's modkit bedMethyl,
  `ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.{1,2}.bedmethyl.gz`
  (HP1/HP2, ~20x each, 610 MB, no `.tbi`). Slice a region by streaming it
  through `gzip -dc | awk` (`$4=="m"` for 5mC), then `bgzip` and `tabix -p bed`,
  from a scratchpad script, since the worktree guard refuses an inline `curl |
  gzip` chain; chr15 sorts early, so a slice takes about a minute.
  chr15:22–27 Mb shows the imprinting: HP1 methylated at the SNRPN promoter, HP2
  across the SNHG14 gene body. The hosted `HG002_SNRPN_hp{1,2}` cover 200 kb.

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
- **The T2T apes Cactus chains (`demos/t2t_apes_cactus/apes.pif.gz`) are
  unnetted and nest**: hg38 vs chimp has one chain over all of chr17 and a
  reversed one in its gap at 17q12, so a `tabix | awk` span census reports both
  strands for every ape. Count CIGAR-aligned bases in the window (the display
  already clips by CIGAR).

## "Make this figure on better data" is often a claim the data cannot make

Count before hunting for new data, and again before deleting a figure.
`multisv_rhd_dosage` wanted arcs over a deletion that produces one spanning pair
(NAHR between identical repeats aligns collinearly), and
`alignments/strand_split_coverage` already had the strandedness in frame. Both ship a
`website/scripts/` script that prints the numbers.
