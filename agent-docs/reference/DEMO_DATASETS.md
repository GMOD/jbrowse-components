---
name: demo-datasets
description: Which demo data has limits that render as bugs, which loci were chosen by measurement, which datasets were rejected, and which format traps bite a new demo build? Read before choosing a demo locus or swapping a dataset.
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
- **The COLO829 modkit bedMethyl file covers chr20 only**, so
  `colo829_cram_and_bedmethyl` works only there.
- **Hosted `ecoli_pggb_depth.bw` / `ecoli_pggb_pav_*.bw` are 500 bp binned means**,
  so a figure below ~5 kb gets one flat bar. No `.og` or full pggb GFA is hosted.
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
- **A length ratio in MCScan synteny is not a bug**: `demos/grape_peach_cacao`
  blocks are gene anchors, legitimately many-to-one.
- **pggb `-M` MAF rows violate the MAF spec**: smoothxg pads each POA block's rows
  past the declared `size`. Declared coordinates stay correct; the padding rendered
  as periodic phantom inserts.
- **A hub config's paths are relative to its own directory and not all sit under a
  `uri` key** (`TwoBitAdapter`'s `chromSizes` is a bare string). An absolutizer
  rewriting only `uri` leaves `chrom.sizes` pointing at the demo's folder
  (`build_hg38_liftover_multiway.sh`).
- **Read strand is transcript strand in HSV-1 ERR2379735** (poly(A)-selected) and
  is not in the randomly primed ERR2379736.
- **minigraph writes no P or W lines**, so the mouse graph cannot express carriage;
  `firstSeenIn`/`discoveryRank` is construction order. The bovine graph's rank above
  0 is P-line order, also not carriage.
- **A `plink --maf` floor decides what an LD panel can say.** Both Anopheles 2La
  panels use `--maf 0.2`, and Gabon's inverted arrangement is 5 of 138 haplotypes,
  so its tag variants sit below the floor. An empty panel speaks only to common
  variation. The LD status bar names only the pair window, so never gate a
  screenshot on a "… variants shown" text.
- **The K562 BCR-ABL1 locus is one donor and many acceptors**, and the arc/tick
  count in `cancer_sv/k562_bcr_abl_split` depends on framing (an interchromosomal
  arc draws only when both feet are on screen). Whether the dominant acceptor is
  alternative splicing or an alignment artefact is not established.
- **The DTU demo's annotation is pinned to GENCODE v29 by transcript versions**: v49
  matches 347 of 631 called IDs, so a newer release silently loses them. The gate is
  `regular_FDR`, since no transcript passes satuRn's empirical FDR on this contrast.
- **`demos/arabidopsis_pangenome` lanes draw gene annotation only**
  (`laneAnnotation.ts` ranks GFF3, GTF, BED), so methylation bigWigs cannot ride in a
  lane. jb2hubs launches pass `dataset.reference.assembly`; check
  `checkPangenomeLaunches.mjs` before choosing a reference name.

## Loci picked by measurement

Don't re-pick by reputation.

- **1000G population CNV → `chr17:36,080,000-36,270,000` (CCL3L1/CCL4L1).** Carries
  every integer copy number 0-10 over 104 PUR samples; AMY1, LPA, HP and UGT2B17
  span less.
- **COLO829 methylation → `chr20:21,505,200-21,514,000`.**
- **Arabidopsis bisulfite → `NC_003070.9:4,398,000-4,412,000`.** The old demo
  looked blank because chr1 euchromatin is globally CHH-unmethylated.
- **One strain absent, the rest present → K12 `chr:501,500-539,000`.** Beats the
  longer runs (`chr:1,489,500-1,533,000` is speckled; `chr:4,496,500-4,536,500` and
  `chr:262,500-302,500` go all white). "Most troughs are K12-private" is false.
- **Strand-split coverage → HSV-1 `NC_001806.2:41,900-45,300` (UL21/UL22).** US9 vs
  US10-US12 flips harder but at ~2,500 reads the pileup cannot draw.
- **Synteny against a real diploid → `demos/hg002` mat-vs-pat.** Inversion
  `chr8_MATERNAL:7,822,846-11,688,252` vs `chr8_PATERNAL:7,774,085-11,631,556`
  separates code handling strand from code that merely compiles. No-answer case:
  `chr8_MATERNAL:12,061,654-12,122,837`.
- **TP53 `chr17:7,400,000-7,700,000`** for `primate_orthologs` and `hg38_vertebrates`;
  AMY1 `chr1:103,500,000-103,800,000` is the symbol join's negative (LOC ids).
- **`ecoli_orthologs`**: atp operon `NC_000913.3:3,910,000-3,925,000`; O-antigen
  cluster `NC_000913.3:2,095,000-2,115,000` as the accessory-genome negative. Past
  ~500 kb the stack is unreadable.
- **CFHR3/CFHR1 deletion in `hprc_multiway` → `chr1:196,700,000-197,000,000`.**
  `hprc_multiway` is a star, so its default session is a plain LGV on hg38.

## Datasets tried and rejected

- **DGRP In(2L)t for an LD triangle.** An inversion suppresses recombination only
  between arrangements; the LD heatmap wants local kb-scale haplotype blocks.
- **One sample showing an inversion in both short and long reads.** HG02768 is not
  in the 1000G ONT set. Best loadable ONT source is IGSR 1KG_ONT_VIENNA.
- **The GenArk viral hub for Nextstrain demos.** Its RefSeq strains do not match the
  Nextstrain build references, except measles NC_001498.
- **COLO829 for canonical imprinting.** LOH at every DMR; the methylation tutorial
  uses HG002 germline ONT instead.
- **Great ape HSA16 all-vs-all PAF.** `-c` with `-P` exhausted 30 GB RAM plus 54 GB
  swap on satellite arrays; drop `-P`. See
  [ideas/collections/synteny-comparative.md](../ideas/collections/synteny-comparative.md).
- **Teaching `NcbiSequenceReportAliasAdapter` `*_assembly_report.txt`** was tried and
  reverted.

## Where things live

- **1000G CNV**: 2504 BigWigs under `genomes/GRCh38/1000g/kidd_lab_cnv/`; the Zarr
  store is hosted via the main-branch `test_data` deploy, so make no second copy under
  `/demos/`. 1000G VCFs need no re-hosting (EBI FTP is CORS-open and byte-range
  capable; its `...ALL.panel` is a `samplesTsvLocation`).
- **HG008-T is hypodiploid, not near-triploid**; the clone track's CN 3 baseline is
  CNVkit median-centering.
- **Querying a tumour CRAM without downloading it**: the header `UR` is a path on
  the submitter's cluster, so skip SEQ, the only field needing the reference:
  `samtools view --input-fmt-option required_fields=0x87F -F 1540 <url> <region>`.
- **ASW trio ancestry** is deliberately not an AMR trio: 1000G has no unadmixed
  Native American reference.
- **TCGA** has two tutorials (`tcga_cohort_cnv.md`, `tcga_cohort_mutations.md`);
  extend them. `build_tcga_cohort_cnv_zarr.sh` stays separate so it skips the GDC
  download.
- **BXD/GeneNetwork** lives in `test_data/config_bxd.json` (mm10), kept out of
  `config_demo.json`, which stays human-only.
- **The mouse graph is built, not published** (`build_mouse_pangenome.sh`): one
  rGFA per chromosome so peak RSS stays bounded, with each job gated on available
  memory. Coverage gaps are the assemblies' (chrX 18, chrY mm39 alone).
- **The bovine graph's published GFAs are not rGFA** (`gfa_paths_to_rgfa.py`
  recovers `SN` tags). `genome_annotation.bed.gz` is a repeat/mappability
  classification, not a gene annotation.
- **`hprc_multiway` bridges records** with `--max-gap 10000`; the impg build stays
  hosted under its original names because each route's `chrom.sizes` lists only the
  contigs it aligned. Details: [HPRC_RELEASE2.md](HPRC_RELEASE2.md).
- **`primate_orthologs`/`ecoli_orthologs`** are symbol joins with no aligner. Check
  symbol presence before pinning a list: older PGAP annotations carry locus tags, and
  NCBI's ape `C1H1orf35` reads as human `C1orf35`. Human is `hg38` because the GenArk
  hub for GCF_000001405.40 names files UCSC never published.
- **`MultiPairwiseSyntenyAdapter` offers the coarse tier only when every child
  carries one** (`tabix -l | grep -c '^[TQ]'`).
- **rastair methylation BED** is not modkit bedMethyl; detection keys on the
  `#`-header columns, and `beta_est` is 0-1, scaled ×100 to match modkit.

## Where a new demo's annotation comes from

**Default to `datasets download genome accession <acc> --include gff3,protein`**
(`build_grape_peach_cacao_synteny.sh` is the multi-genome version). One accession
names one assembly, and the same CLI emits the `seq-report` an INSDC-accession
assembly needs for aliases.

Either way the source is a build-time host: `website/scripts/third-party-hosts.txt`
carries neither, so figures, the weekly sweep and tutorials read from jbrowse.org.

Scripts still on Ensembl: `build_orthofinder_synteny.sh` (`wheat` cannot switch;
`vertebrates` and `grasses` could), `build_oat_homoeologs.sh` (no NCBI oat models),
`build_wheat_homoeologs.sh` (Compara tables), `build_grape_peach_anchors.sh` (the
clearest switch candidate). Switching a working demo means a new OrthoFinder or
anchor run and a re-upload, so do it while the script changes for another reason.

## Format gotchas

- **A GDC MAF's `CONTEXT` column carries the indel anchor base** VCF needs
  (`CONTEXT[5]`), so MAF-to-VCF needs no reference FASTA.
- **Don't hand-write a refNameAliases file for an INSDC-accession assembly.**
  `datasets download genome accession <GCA> --include seq-report`, then `dataformat
  tsv genome-seq --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name`.
- **UCSC GenArk hubs are keyed on RefSeq accessions**, so a hub track drops into a
  config for the same assembly with no aliasing. Check
  `hgdownload.soe.ucsc.edu/hubs/GCF/...` before hosting your own.
- **MANE Select's symbol column is `geneSymbol`**, not `geneName2`. Filter on the
  accession (CDKN2A has two MANE entries).
- **Don't take a repeat's identity from the Ensembl REST API**: it returned the
  right interval under a chr4 id on chr1. Use the assembly's own annotation.

## "Make this figure on better data" is often a claim the data cannot make

Count before hunting for new data, and again before deleting a figure.
`multisv_rhd_dosage` wanted arcs over a deletion that produces one spanning pair
(NAHR between identical repeats aligns collinearly), and
`alignments/strand_split_coverage` already had the strandedness in frame. Both ship a
`website/scripts/` script that prints the numbers.
