---
name: demo-datasets
description: The data behind the demos, figures and tutorials — which fixtures cover only one contig, which loci were picked by measurement and must not be re-picked by reputation, which candidate datasets were tried and rejected, where each pipeline's build scripts live, and the file-format gotchas that cost hours. Read before choosing a demo locus, swapping a dataset, or diagnosing a figure that renders empty.
---

# Demo datasets

Provenance and limits for the data behind figures and tutorials. Most entries
are here because re-deriving them is expensive or because the data has a limit
that renders as a bug.

Hosting, CDN and upload mechanics are in [HOSTING.md](HOSTING.md).

## Limits that look like bugs

- **Most `test_data/volvox` fixtures are ctgA-only** — `volvox-sorted.bam`,
  `volvox.bw`, `volvox_sine.bw`, `volvox-sorted.bam.coverage.bw`, every
  `volvox_microarray*.bw`. Both contigs: `posneg_rw{1..4}.bw`, `v{1..4}.cram.bw`.
  `volvox.sort.gff3.gz` has 5 ctgB features. `volvox_microarray.altname.bw` /
  `_contigA.bw` use refname `contigA` — alias fixtures, not extra coverage. A
  view on ctgB with the usual wiggle + reads tracks draws nothing while genes
  keep drawing: correct rendering of absent data, indistinguishable from a failed
  fetch.
- **The COLO829 modkit bedMethyl demo file covers chr20 only** (`tabix -l` →
  `chr20`). Any other locus returns 0 rows, so
  `colo829_cram_and_bedmethyl` only works on chr20. The paired CRAM is
  whole-genome and fast (crai 578 KB / ~1s) — not the bottleneck.
- **Hosted `ecoli_pggb_depth.bw` / `ecoli_pggb_pav_*.bw` are 500 bp binned
  means** by construction, so values are non-integer and any figure below ~5 kb
  gets one flat bar. No `.og` and no full pggb GFA are hosted — only a 461 bp
  `ecoli_pggb_subgraph.gfa` and an 810 kB `ecoli_rgfa_slice.gfa` (minigraph, a
  different graph).

## Loci picked by measurement — don't re-pick by reputation

- **1000G population CNV → `chr17:36,080,000-36,270,000` (CCL3L1/CCL4L1).**
  Over the 104 PUR samples this window carries every integer copy number 0-10.
  AMY1 only reaches 0-4 at 1 kb resolution, LPA 2-8, HP 2-7, UGT2B17 0-2; the old
  gallery window (chr3:162.3-163.4Mb) has a spread of 0.26.
- **COLO829 methylation → `chr20:21,505,200-21,514,000`.** Hypomethylated
  CpG:158 (~20%) beside a densely methylated CpG:26/33/214 cluster (~90%) in one
  window.
- **Arabidopsis bisulfite → `NC_003070.9:4,398,000-4,412,000`.** Gene-body
  CpG-only methylation on AT1G12930 beside a silenced tri-context element
  (AT1G12935 + unannotated repeat). The old demo looked blank because that chr1
  euchromatin is globally unmethylated in CHH.

## Datasets tried and rejected

- **DGRP In(2L)t for an LD triangle.** Measured on `dgrp_In2Lt_2L.vcf.gz`: a
  30 kb window inside the inversion has r² mean **0.026** vs **0.033** in a
  flank — no block. An inversion suppresses recombination only *between*
  arrangements, so a local window recombines normally; the block is a long-range
  phenomenon needing 4000+ SNPs on screen. LDDisplay wants local kb-scale
  haplotype blocks, not Mb-scale low-frequency SVs.
- **One sample showing an inversion in both short and long reads.** HG02768 is
  not in the 1000G ONT set, and HGSV_2721 is a private singleton — HG02768 is
  the only carrier among all 3202 ensemble-callset samples. Best loadable ONT
  source is IGSR 1KG_ONT_VIENNA (1019 samples, hg38 CRAMs, CORS-enabled,
  chr-prefixed).
- **The GenArk viral hub for Nextstrain demos** (`processedHubJson/viral.json`,
  15063 assemblies) — different RefSeq strains whose coordinates don't match the
  Nextstrain build references, except measles NC_001498.
- **COLO829 for canonical imprinting** — a cancer line with LOH at every DMR.
  The methylation tutorial uses HG002 germline ONT (`ont-open-data`,
  `giab_2025.01/.../HG002/PAW70337/`) instead.

## Cancer and C-GIAB

- **HG008-T is hypodiploid, not near-triploid** — 35 T2T tumor chromosomes,
  mean CN ~1.5 over 2,490 Mb, CN1 1,280 Mb vs CN2 1,162 Mb, ~55% of covered
  genome carrying a zero haplotype. Depth is cleanly linear (CN1/2/3 →
  55x/110x/175x). The clone track's CN 3 baseline is CNVkit median-centering.
- **Subclonal CNV cohort** — 8 real HG008-T single-cell-*derived clonal cell
  lines (bulk WGS, not scWGS): `2D6 2E6 3E4 SC6 SC9 SC14 SC24 SC28`, CNVkit
  `.cnvkit.call.cns` from the C-GIAB FTP, concatenated with a `clone` column into
  one BED. The reusable pattern is stacking per-sample CNV *segments* as rows to
  compare a cohort without loading BAMs.
- **Published (not home-rolled) tracks**, answering "use a production-grade
  pipeline": the NYGC somatic pipeline's bicseq2 log2 copy ratio for
  HG008-T/HG008-N (196 segments), plus per-site LCT Fst.
- **Querying the tumour CRAM without downloading it** — its header `UR` is an
  absolute path on the submitter's cluster and `-T` against our hg38 fails, so
  use `required_fields` to skip SEQ, the only field CRAM needs the reference for:
  `samtools view --input-fmt-option required_fields=0x87F -F 1540 <url> <region>`.
- **Read-pair Hi-C heatmap** (Cue-style): bin ordinary paired-end WGS into a
  `.hic` contact matrix and each SV is an off-diagonal spot. Built from HG008-T
  Illumina 161x via `scripts/build_readpair_heatmap_cgiab.sh`, using
  `samtools view -q20 -f65 -F2316` for one primary record per pair.

## Cohort and population

- **1000G CNV** — all 2504 mirrored BigWigs verified resolving (2504/2504 → 206)
  at `genomes/GRCh38/1000g/kidd_lab_cnv/<POP>/<SAMPLE>.qm2.CN.1k.bw`. The Zarr
  store and config are already hosted via the main-branch `test_data` deploy;
  don't make a second copy under `/demos/`.
- **ASW trio ancestry** — real 1000G African-American trio (child NA19828,
  father NA19818, mother NA19819) as a two-way AFR/EUR FLARE local-ancestry
  mosaic (~59/41). Deliberately not an AMR trio: 1000G has no unadmixed Native
  American reference, so painting AMR with 1000G-only references misassigns.
- **KHV trio hap-IBD** — `HG02024_VN049_KHVTrio.chr1.hapibd` in
  `config_demo.json`, `LinearMultiRowFeatureDisplay` partitioned by BED column
  `parenthap`, 4 rows (each parent's two haplotypes). Each crossover is the
  boundary where a block steps between a parent's paired rows.
- **TCGA** — two tutorials only (`tcga_cohort_cnv.md`,
  `tcga_cohort_mutations.md`); extend them rather than adding pages.
  `build_tcga_cohort_cnv_zarr.sh` is deliberately separate from
  `build_tcga_cohort_cnv.sh`: its inputs are the latter's hosted BED and clinical
  TSV, so it runs standalone in ~28s instead of repeating a 15-25 min GDC
  download.
- **BXD/GeneNetwork** — `test_data/config_bxd.json`, mm10, real mouse
  systems-genetics data (multi-row painting + gwas Manhattan). Kept out of
  `config_demo.json`, which stays human-only.
- **ChromHMM chromatin state** — `demos/chromhmm/`, hg19, row per epigenome via
  `partitionField: cellType`, color from `itemRgb`. UCSC Broad ENCODE
  (9 cell types, 15-state, 74MB, 5.4M segments) and Roadmap 127-epigenome.
- **1000 Genomes VCFs need no re-hosting.** The EBI FTP is CORS-open and
  byte-range capable, so a `VcfTabixAdapter` can point straight at it. Its
  `integrated_call_samples_v3...ALL.panel` is a ready-made `samplesTsvLocation`
  (sample / pop / super_pop / gender), so grouping and coloring by population
  costs no new file either.
- **Precomputed LD is region-queried, so file size doesn't matter.**
  `PlinkLDTabixAdapter` + `LDTrack` render plink `--r2` output;
  `plugins/variants/scripts/plink2ld.sh` does the conversion. Note that
  `LDDisplay` suppresses its "… variants shown" status bar for precomputed LD,
  so never gate a screenshot on that text.
- **A `plink --maf` floor decides what an LD panel can say.** Both Anopheles
  2La panels are built at `--maf 0.2`, and Gabon's inverted arrangement is 5 of
  138 haplotypes — so its tag variants are below the floor and simply absent
  from the file. An empty LD panel there is evidence about the *common*
  variation only, not a claim that nothing is linked.

## Pangenome and comparative

- **The pangenome tutorial teaches four linear projections** of a pggb graph,
  because JBrowse has no graph-native adapter: synteny (wfmash PAF → `make-pif`
  → `AllVsAllIndexedPAFAdapter`), variants (`pggb -V` VCF →
  `LinearMultiSampleVariantMatrixDisplay`), MAF (`pggb -M` → re-root →
  `BgzipTaffyAdapter`), and depth/PAV bigWigs.
- **73% of pggb `-M` MAF rows violate the MAF spec** — smoothxg (v0.8.2,
  `poa-length-target 700,1100`) pads each POA block's rows past the declared
  `size`. Declared coordinates stay colinear and correct. This rendered as
  periodic ~300bp phantom inserts and cost hours to diagnose (fixed
  `95616b5201`).
- **Multiway synteny** uses `colorBy: reference`, the meaningful multi-way mode;
  `drawCurves` defaults false and the figures show straight ribbons.

## Other demos

- **DTU (differential transcript usage)** — ENCODE ENTEx muscle vs liver,
  satuRn stats written into a GENCODE GFF3. Pipeline lives only in
  `~/scratch/dtu/`; **nothing in the repo rebuilds the GFF**.
- **Hi-C translocation** — GM12878 vs K562 BCR-ABL1, two windows (chr9 ABL1,
  chr22 BCR) in one LGV so JBrowse fetches the chr9×chr22 block: empty in a
  normal karyotype, solid in K562. Replaced an orphaned loops-arc config.
- **SV-GWAS** — `plugins/gwas` extended so ranged SVs draw as a bar spanning
  start→end at the score height while points stay discs. Glyph is chosen by
  pixel span, not SV type.
- **Nextstrain examples** — reference sequence comes from Nextstrain's own
  `_root-sequence.json` sidecar where it exists (covid, ebola, rsv-a), else the
  GenBank `.gb` ORIGIN from the build repo (zika, measles). Zika is a
  polyprotein: 12 mature peptides render as subfeatures of one mRNA, not 12
  genes.
- **rastair** methylation BED (TAPS / mod-C→T) is not modkit bedMethyl;
  detection keys on the `#`-header column names (`beta_est unmod mod coverage`),
  and `beta_est` is 0-1, scaled ×100 to match modkit.

## Format gotchas

- **A GDC MAF's `CONTEXT` column carries the indel anchor base VCF needs**, laid
  out as 5 bases + the REF allele + 5 bases, so `CONTEXT[5]` is the anchor for
  every row. MAF-to-VCF therefore needs no reference FASTA.
- **Don't hand-write a refNameAliases file for an INSDC-accession assembly.**
  The NCBI datasets CLI emits exactly the four columns
  `NcbiSequenceReportAliasAdapter` reads:
  `datasets download genome accession <GCA> --include seq-report`, then
  `dataformat tsv genome-seq --fields
  genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name`. This is how the
  wheat *timopheevii* row stopped being labelled `OY997263.1`. Prefer the CLI to
  a hardcoded NCBI FTP URL — teaching the adapter to read
  `*_assembly_report.txt` was tried and reverted as unnecessary.
- **UCSC GenArk hubs are keyed on RefSeq accessions**, so a track from one drops
  into a config for the same assembly with no aliasing — the TAIR10 RepeatMasker
  bigBed's chroms *are* `NC_003070.9` and friends, which is what let it land
  straight in the Arabidopsis bisulfite config. Worth checking before hosting
  anything of your own for a non-model assembly:
  `https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.3/bbi/`.
- **MANE Select's symbol column is `geneSymbol`**, not `geneName2` (confirm with
  `bigBedInfo -as`). Filtering still wants the accession — CDKN2A has two MANE
  entries — but `labels: { name: "jexl:get(feature,'geneSymbol')" }` makes the
  glyph label itself, and that is a config slot, so it goes in the track's
  `displays`.
- **Don't take a repeat's identity from the Ensembl REST API.** It returned the
  right interval for an Arabidopsis element under the id `AT4TE22180` — a chr4
  id on chr1. TAIR10's own `TAIR10_Transposable_Elements.txt` calls it
  `AT1TE14315`. It is also flaky. Take the identity from the assembly's own
  annotation file.

## "Make this figure on better data" is often a claim the data cannot make

The check is a count, and it is cheap. Two figures were asked to be rebuilt on
more dramatic data and both ended in a measurement instead:

- `multisv_rhd_dosage` wanted arcs over a deletion that produces **one** spanning
  read pair in its homozygous carrier — it is NAHR between ~9 kb identical
  repeats, so a junction-spanning fragment aligns collinearly and there is no
  read-pair signal to draw. The band that was there was drawing RHD↔RHCE
  paralogy, busiest in the 0/0 control.
- `alignments/strand_split_coverage` wanted dramatic strandedness that was
  already in the frame at one column: 0.00 mismatch on 12 forward reads against
  1.00 on 10 reverse.

Both now ship a script in `website/scripts/` that prints the numbers, which is
what makes the answer re-checkable rather than an assertion. **Count before
hunting for new data, and again before deleting a figure.**
