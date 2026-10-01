---
name: demo-datasets
description: The data behind the demos, figures and tutorials: single-contig fixtures, loci picked by measurement, rejected candidates, which annotation source a new demo takes, and the file-format gotchas. Read before choosing a demo locus or swapping a dataset.
audience: internal
kind: dataset
---

# Demo datasets

Provenance and limits for the data behind figures and tutorials. Entries are here
because re-deriving them is expensive or because the data has a limit that renders
as a bug. Hosting, CDN and upload mechanics are in [HOSTING.md](HOSTING.md). Each
demo's `README.txt` or build script holds exact counts and sizes.

## Limits that look like bugs

- **Most `test_data/volvox` fixtures are ctgA-only** (`volvox-sorted.bam`,
  `volvox.bw`, `volvox_sine.bw`, `volvox_microarray*.bw`). Both contigs:
  `posneg_rw{1..4}.bw`, `v{1..4}.cram.bw`; `volvox.sort.gff3.gz` has 5 ctgB
  features; `volvox_microarray.altname.bw` / `_contigA.bw` use refname `contigA` as
  alias fixtures. A ctgB view draws genes and nothing else, which is correct
  rendering of absent data and indistinguishable from a failed fetch.
- **The COLO829 modkit bedMethyl demo file covers chr20 only**, so
  `colo829_cram_and_bedmethyl` works only there. The paired CRAM is whole-genome and
  fast.
- **Hosted `ecoli_pggb_depth.bw` / `ecoli_pggb_pav_*.bw` are 500 bp binned means**,
  so any figure below ~5 kb gets one flat bar. No `.og` or full pggb GFA is hosted,
  only a 461 bp `ecoli_pggb_subgraph.gfa` and `ecoli_rgfa_slice.gfa` (minigraph, a
  different graph).

## Loci picked by measurement — don't re-pick by reputation

- **1000G population CNV → `chr17:36,080,000-36,270,000` (CCL3L1/CCL4L1).** Over the
  104 PUR samples it carries every integer copy number 0-10; AMY1, LPA, HP and
  UGT2B17 span less.
- **COLO829 methylation → `chr20:21,505,200-21,514,000`.** Hypomethylated CpG:158
  beside a densely methylated CpG:26/33/214 cluster.
- **Arabidopsis bisulfite → `NC_003070.9:4,398,000-4,412,000`.** Gene-body CpG-only
  methylation on AT1G12930 beside a silenced tri-context element; the old demo
  looked blank because chr1 euchromatin is globally CHH-unmethylated.
- **One strain absent, the rest present → K12 `chr:501,500-539,000`** (pggb `odgi
  pav` bigWigs; `pangenome/pav` shades it). IAI39 is 0 throughout, NCTC86 is 1, and
  CFT073 drops over `chr:523,000-530,000` only (the rhsD Rhs element). It beats the
  longer runs (`chr:1,489,500-1,533,000` is speckled; `chr:4,496,500-4,536,500` and
  `chr:262,500-302,500` go all white). "Most troughs are K12-private" is false; only
  the deepest are.
- **Strand-split coverage → HSV-1 `NC_001806.2:41,900-45,300` (UL21/UL22).**
  Opposite-strand genes at comparable depth (~150 vs ~5 reads a strand). US9 vs
  US10-US12 flips harder but at ~2,500 reads the pileup cannot draw.
- **Synteny against a real diploid → the `demos/hg002` mat-vs-pat chain.**
  - **Inversion → `chr8_MATERNAL:7,822,846-11,688,252` vs
    `chr8_PATERNAL:7,774,085-11,631,556`** (8p23.1, the largest inverted block, with
    collinear chains either side of both breakpoints): separates code handling strand
    from code that merely compiles.
  - **Hap-specific sequence → `chr8_MATERNAL:12,061,654-12,122,837`**, covered by no
    chain: the "legitimately no answer" case.
  - The track is a **self-alignment** (both `assemblyNames` are `hg002v1.2`), so it
    exercises genome-against-itself special cases. **A `-` strand chain stores query
    coordinates in reverse-complement space** (forward = `qSize - qEnd .. qSize -
    qStart`); read as forward they put the inversion 127 Mb away and look like a
    translocation.
- **Sparse, short-block synteny → the `demos/grape_peach_cacao` MCScan track.** The
  opposite shape from chain/PAF demos (~1000 blocks at whole-genome zoom, widest
  127 kb against 27.8 Mb), found a window-vs-block bug. **A length ratio is not a
  bug**: these are gene anchors, legitimately many-to-one (six grape genes map to
  one peach interval; 200 kb of grape corresponds to ~36 kb of peach). Assemblies
  and gene tracks are the GenArk hubs on genomes.jbrowse.org, verbatim but for the
  label. UCSC names are canonical so the ruler reads `chr1`/`chrG1` while the BEDs
  keep RefSeq accessions (`NC_081805.1`, `NC_034009.1`).

## Datasets tried and rejected

- **DGRP In(2L)t for an LD triangle.** A 30 kb window inside the inversion has r²
  mean 0.026 vs 0.033 in a flank. An inversion suppresses recombination only between
  arrangements; the LD heatmap wants local kb-scale haplotype blocks.
- **One sample showing an inversion in both short and long reads.** HG02768 is not in
  the 1000G ONT set and HGSV_2721 is a private singleton. Best loadable ONT source is
  IGSR 1KG_ONT_VIENNA (hg38 CRAMs, CORS-enabled).
- **The GenArk viral hub for Nextstrain demos.** Its RefSeq strains do not match the
  Nextstrain build references, except measles NC_001498.
- **COLO829 for canonical imprinting.** A cancer line with LOH at every DMR; the
  methylation tutorial uses HG002 germline ONT (`ont-open-data`) instead.
- **Great ape HSA16 all-vs-all** (Yoo et al. 2025, SVbyEye plotAVA, six-row synteny
  stack). A build script was removed without emitting a PAF (`git show 17a7b2a4d5`).
  Sequence is cheap (chr18 in each ape, `.fai`/`.gzi` beside each FASTA allow range
  requests; check lengths, since a truncated range still looks like valid FASTA).
  `--secondary=no` cannot combine with `-X`/`-P`. **`-c` with `-P` killed it**:
  base-aligning every paralogous chain in satellite arrays exhausted 30 GB RAM plus
  54 GB swap. Drop `-P` (SVbyEye's pairwise recipe omits it). The open question is a
  machine, not a method;
  [ideas/collections/synteny-comparative.md](../ideas/collections/synteny-comparative.md)
  has a different route (precomputed ntSynt blocks).

## Cancer and C-GIAB

- **HG008-T is hypodiploid, not near-triploid** (35 tumor chromosomes, mean CN ~1.5).
  Depth is linear in CN (CN1/2/3 → 55x/110x/175x); the clone track's CN 3 baseline
  is CNVkit median-centering.
- **Subclonal CNV cohort**: 8 HG008-T single-cell-derived clonal lines (bulk WGS),
  CNVkit `.cnvkit.call.cns` from the C-GIAB FTP, concatenated with a `clone` column.
  The reusable pattern is stacking per-sample CNV segments as rows to compare a
  cohort without loading BAMs.
- **Published tracks, not home-rolled**: the NYGC somatic pipeline's bicseq2 log2
  copy ratio for HG008-T/N, plus per-site LCT Fst.
- **K562's BCR-ABL1 is one donor and many acceptors, not one junction.**
  `K562_isoseq.bam` at `chr22:23,286,000-23,293,000` has an essentially exact BCR
  donor (23,290,412-415) and 24 distinct chr9 SA start positions, 23 inside ABL1;
  130,854,064 is the ABL1 exon-2 acceptor (the canonical e14a2 junction the DepMap
  STAR-Fusion call reports). `cancer_sv/k562_bcr_abl_split` has three displayed
  regions because an interchromosomal connection draws as an arc only when both feet
  are on screen, so framing decides which junctions are arcs; any arc/tick count read
  off it is a statement about the framing. Whether the dominant acceptor is
  alternative splicing or a recurrent alignment artefact is **not established**. The
  long gaps are `N` (skip) ops up to 198 kb, not `D`, which is what spliced Iso-Seq
  across ABL1 introns looks like. Reproduce with `samtools view <url>
  chr22:23,286,000-23,293,000` and count `chr9,<pos>,`.
- **Querying the tumour CRAM without downloading it**: its header `UR` is an absolute
  path on the submitter's cluster, so use `required_fields` to skip SEQ, the only
  field needing the reference: `samtools view --input-fmt-option
  required_fields=0x87F -F 1540 <url> <region>`.
- **Read-pair Hi-C heatmap** (Cue-style: bin paired-end WGS into a `.hic` so each SV
  is an off-diagonal spot) was removed in `16250c4b58`, which holds the pipeline.

## Cohort and population

- **1000G CNV**: 2504 mirrored BigWigs at
  `genomes/GRCh38/1000g/kidd_lab_cnv/<POP>/<SAMPLE>.qm2.CN.1k.bw`. The Zarr store and
  config are hosted via the main-branch `test_data` deploy; don't make a second copy
  under `/demos/`.
- **ASW trio ancestry**: 1000G African-American trio as a two-way AFR/EUR FLARE
  mosaic. Deliberately not an AMR trio, since 1000G has no unadmixed Native American
  reference.
- **KHV trio hap-IBD**: `config_demo.json`, `LinearMultiRowFeatureDisplay`
  partitioned by BED column `parenthap`; each crossover is a block stepping between a
  parent's paired rows.
- **TCGA**: two tutorials only (`tcga_cohort_cnv.md`, `tcga_cohort_mutations.md`);
  extend them. `build_tcga_cohort_cnv_zarr.sh` stays separate from
  `build_tcga_cohort_cnv.sh` so it skips the 15-25 min GDC download.
- **BXD/GeneNetwork**: `test_data/config_bxd.json` (mm10), kept out of
  `config_demo.json`, which stays human-only.
- **ChromHMM**: `demos/chromhmm/` (hg19), row per epigenome via `rows: cellType`,
  color from `itemRgb`.
- **1000 Genomes VCFs need no re-hosting**: the EBI FTP is CORS-open and
  byte-range capable, and its `...ALL.panel` is a ready `samplesTsvLocation`.
- **Precomputed LD is region-queried** (`PlinkLDTabixAdapter` + `LDTrack`;
  `plugins/variants/scripts/plink2ld.sh`). Its status bar names only the pair window,
  so never gate a screenshot on a "… variants shown" text.
- **A `plink --maf` floor decides what an LD panel can say.** Both Anopheles 2La
  panels use `--maf 0.2` and Gabon's inverted arrangement is 5 of 138 haplotypes, so
  its tag variants are below the floor. An empty panel is evidence about common
  variation only.

## Pangenome and comparative

- **The pangenome tutorial teaches four linear projections** of a pggb graph:
  synteny (wfmash PAF → `make-pif` → `MultiGenomeIndexedPAFAdapter`), variants
  (`pggb -V` VCF), MAF (`pggb -M` → re-root → `BgzipTaffyAdapter`), depth/PAV bigWigs.
- **73% of pggb `-M` MAF rows violate the MAF spec**: smoothxg pads each POA block's
  rows past the declared `size`. Declared coordinates stay correct; it rendered as
  periodic ~300bp phantom inserts.
- **Multiway synteny** uses `color: { field: 'reference' }`; `drawCurves` defaults
  false.
- **`demos/primate_orthologs` is a gene-symbol join, no aligner**
  (`build_primate_orthologs.sh`, `symbols_to_blocks.py`): GRCh38.p14, six T2T apes
  and macaque, RefSeq GFF3 only. The join reads NCBI's ape `C1H1orf35` as human
  `C1orf35`. Lane assemblies and gene tracks are the genomes.jbrowse.org hubs'
  verbatim; human is `hg38` because the GenArk hub for GCF_000001405.40 names files
  UCSC never published (404s). Check symbol presence before pinning a list: older PGAP
  annotations carry locus tags, not symbols. Loci: TP53 `chr17:7,400,000-7,700,000`;
  the 2q13 fusion `chr2:112,500,000-115,500,000`; the AMY1 cluster
  `chr1:103,500,000-103,800,000` as the join's negative (LOC ids).
- **`demos/ecoli_orthologs` is the same join at cohort scale**
  (`build_ecoli_orthologs.sh`): accessions whose longest sequence is a ≥4 Mb
  chromosome, annotation names ≥2,000 genes, assembly report calls them E. coli or a
  named Shigella (a hand-typed list had a Leclercia and a Salmonella);
  `--unnamed '_RS[0-9]+$'`; lane names from the report's strain field. Loci: the atp
  operon `NC_000913.3:3,910,000-3,925,000`; the O-antigen cluster
  `NC_000913.3:2,095,000-2,115,000` as the accessory-genome negative. Past ~500 kb
  the stack is unreadable (no coarse tier; sparse lanes' bridged ribbons sweep the
  track).
- **`demos/hprc_multiway` is the CFH panel's eight haplotypes whole-genome, unpacked
  from the graph** (`build_hprc_multiway_synteny.sh`; `SOURCE=gfa` default via
  `gfa_to_pairwise_paf.py`, `SOURCE=taf` from the published projection), indexed by
  `make-pif` into one two-tier PIF. It is the whole-genome PIF
  [HOSTING.md](HOSTING.md) says the coarse tier needs, and the first hosted
  `MultiGenomeIndexedPAFAdapter` file with PanSN haplotype names, so the track maps
  `assemblyNameToPanSN` (`hg38` → `GRCh38#0`). Build details and agreement with impg:
  [HPRC_RELEASE2.md](HPRC_RELEASE2.md) §"Unpacking pairwise alignments from the
  graph".
  - **Bridged records are alignment-sized.** hal2maf drops an insertion between two
    blocks, so exact chaining leaves ~10 kb pieces; `--max-gap 10000` gives a median
    362 kb record, and a chromosome arm in one row.
  - **It is a star**, and `make-pif` says so ("states only 8 of their 36 pairs").
    That is why the default session is a plain LGV on hg38, not a haplotype-vs-
    haplotype synteny view.
  - **The CFHR3/CFHR1 deletion reads off the raw rows** at
    `chr1:196,700,000-197,000,000`: four carriers break at 196,753,096 and resume at
    196,837,771 (one bubble); impg's rows scatter breakpoints over ~10 kb.
  - **Beside the GFA route the impg build stays hosted** under its original names;
    each route's `chrom.sizes` lists only contigs it aligned, so none can replace
    another in place. Each haplotype's CAT GFF3 drops `intron`/`start_codon`/
    `stop_codon` rows and any gene over 5 Mb with its children (no real human gene
    passes 2.5 Mb). BSD awk is the bottleneck, so `CAT_JOBS` runs haplotypes
    concurrently. `README.txt` beside the data has provenance.
- **`demos/mouse_pangenome` is a graph we built, because nobody published one**
  (`build_mouse_pangenome.sh`): minigraph `-cxggs` over mm39 plus 18 strain
  assemblies rehosted in GenArk, one graph per chromosome renumbered
  (`chromIndex * 10,000,000`) and concatenated into one rGFA. The check that the
  reference thread survived is rank-0 total equalling GRCm39's length.
  - **Coverage gaps are the assemblies'**: chrX carries 18 (C57BL_6J_T2T's alias file
    has no X or Y); chrY carries mm39 alone and is not offered as a whole-chromosome
    view.
  - **minigraph writes no P or W lines**, so the graph cannot express carriage;
    `firstSeenIn`/`discoveryRank` is construction order. `minigraph -cxasm --call` per
    assembly plus `misc/mgutils.js merge -r0` is the cheap route to carriage;
    minigraph-cactus is the route to walks and takes days.
  - **Per chromosome** because peak RSS scales with the growing graph; the build gates
    each job on available memory holding above a floor across three probes 20 s apart
    (a job launched into a dip another job is about to reclaim gets OOM-killed hours
    in).
- **`demos/bovine_pangenome` projects someone else's graph, whose tags had to be
  recovered** (`build_bovine_pangenome.sh`): Leonard et al. 2023 (Zenodo 7737904,
  CC-BY 4.0), 12 assemblies on ARS-UCD1.2.
  - **The published graphs are not rGFA**: no `SN:Z:`, only 12 P lines.
    `gfa_paths_to_rgfa.py` walks each path with a cumulative offset and the first path
    to reach a segment names it. Checked: each chromosome's HER path must sum to
    bosTau9's length. Segments on no path (0.28%) are dropped with their links.
  - **Rank above 0 is P-line order**, weaker than minigraph's SR and not carriage. The
    tarball's base-level `pggb` and `cactus` sets do state walks, so
    `build_pggb_tabix.sh` over one would emit `SM:Z:` carriage with no new download.
  - **The minigraph VCF reproduces published variants** (figures `bovine_polled`,
    `bovine_kit`, `bovine_tas2r46`, `bovine_bola`) but not fine ones (GC duplication,
    PRDM9 zinc fingers, QRICH2/ACAN repeats). OMIA's recessive lethal SVs are absent.
  - **Genotype distance recovers the taurine/indicine/wild split** but places gaur
    with bison and yak (reference-anchored distance saturates); no figure claims the
    tree.
  - `genome_annotation.bed.gz` is a repeat/mappability classification, **not a gene
    annotation**. `gfatools bubble` clamps its path count at 2147483647, meaning "more
    than I can count".
- **`demos/hg38_vertebrates` builds nothing** (`build_hg38_liftover_multiway.sh`
  writes only the config): eight UCSC genomes via the liftOver PIFs at
  `ucsc/hg38/liftOver/hg38To<Genome>.over.pif.gz`, one `PairwiseIndexedPAFAdapter`
  each under a `MultiPairwiseSyntenyAdapter`, assembly and `<g>-ncbiRefSeq` entries
  lifted verbatim from `ucsc/<g>/config.json`. **A hub config's paths are relative to
  its own directory and not all sit under a `uri` key**: `TwoBitAdapter`'s
  `chromSizes` is a bare string, so an absolutizer rewriting only `uri` leaves
  `<g>.chrom.sizes` pointing at the demo's folder. `MultiPairwiseSyntenyAdapter`
  offers the coarse tier only when every child carries one (`tabix -H` shows the
  `#pif` version, `tabix -l | grep -c '^[TQ]'` counts the tier). Locus TP53
  `chr17:7,400,000-7,700,000`.
- **`demos/arabidopsis_pangenome` is 26 1001G+ Phase 1 accessions against TAIR10**
  (`scripts/build_arabidopsis_pangenome.sh`, run on ada). Its `README.txt` holds the
  provenance and the chromosome 4 knob finding, which only the SyRI track shows
  (minigraph holds no knob-sized bubble). A session spec naming `GCF_000001735.4`
  opens `TAIR10` through its `aliases`, but jb2capture's census wants the literal
  name; jb2hubs launches pass `dataset.reference.assembly`, so check
  `checkPangenomeLaunches.mjs` before choosing a reference name. Lanes draw gene
  annotation only (`laneAnnotation.ts` ranks GFF3, GTF, BED), so methylation bigWigs
  cannot ride in a lane.

## Other demos

- **DTU (differential transcript usage)**: ENCODE ENTEx muscle vs liver, satuRn
  stats in a GENCODE GFF3 (`website/docs/tutorials/dtu.md`;
  `scripts/build_dtu_demo.sh`). No transcript passes satuRn's **empirical** FDR on
  this contrast, so the gate is `regular_FDR`; the sample list is written out because
  ENCODE portal facets move. The hosted GFF3 carries statistics on gene and
  transcript rows only (a transcript's parts paint its value) and no `Name=`. **The
  annotation is pinned to GENCODE v29 by transcript versions**: v49 matches only 347
  of 631 called IDs exactly, so a newer release silently loses them. UCSC serves v29
  as `wgEncodeGencodeCompV29`/`wgEncodeGencodeAttrsV29` (genePred, not GFF3).
- **The `*.demo_slices.bam` files** (HG002 ONT haplotagged, HG002 Illumina 2x250,
  HG008-T PacBio Revio; `scripts/build_demo_slices.sh`).
  - **A sliced BAM records its own provenance** in an `@PG` line: `samtools view -H
    <slice>.bam | grep -oE 'CL:samtools view -b -o .*'`. Try it first for any hosted
    BAM of unclear origin.
  - **Cut each region wider than every window that displays its reads.** Depth inside
    a region is the source's exactly, but outside it decays smoothly over a read
    length, looks like coverage, and nothing marks it as an edge (an HG008 chr3
    region cut 18 kb short drew a collapse over a breakend the full BAM shows as a
    gain).
  - **A sliced track cannot back a genome-wide run**: `jb2export batch` over the
    HG008 SV callset renders ~150 junctions against a slice, so all but a handful come
    out as empty pileups with the run reporting success. Point it at the full NCBI BAM
    (a range request per junction).
  - The two HG002 slices share one region set; HG008 is GRCh38 and the others hs37d5,
    so the `chr` prefix differs by assembly.
- **Hi-C translocation**: GM12878 vs K562 BCR-ABL1, two windows (chr9 ABL1, chr22
  BCR) in one LGV so JBrowse fetches the chr9×chr22 block (empty in a normal
  karyotype, solid in K562).
- **SV-GWAS**: a `rule` from start to end at the score height under a `point` at its
  middle, shaped by SV type.
- **Nextstrain examples**: reference sequence from Nextstrain's `_root-sequence.json`
  (covid, ebola, rsv-a), else the build repo's GenBank `.gb` ORIGIN (zika, measles).
  Zika's 12 mature peptides render as subfeatures of one mRNA.
- **HSV-1 long-read mRNA** (`demos/hsv1/`, `scripts/build_hsv1_demo.sh`): NC_001806.2
  plus ERR2379735 (poly(A)-selected, PRJEB25433). **Read strand is transcript strand
  here and is not in the study's randomly primed run ERR2379736** (50/50). A 152 kb
  genome with 74 genes on both strands and almost no splicing makes it the right shape
  for any figure about strand.
- **rastair** methylation BED (TAPS / mod-C→T) is not modkit bedMethyl; detection keys
  on the `#`-header columns (`beta_est unmod mod coverage`), and `beta_est` is 0-1,
  scaled ×100 to match modkit.

## Where a new demo's annotation comes from: NCBI datasets, then Ensembl

**Default to `datasets download genome accession <acc> --include gff3,protein`**
(`build_grape_peach_cacao_synteny.sh` is the worked multi-genome version;
`build_primate_orthologs.sh` the cheapest, `gff3,seq-report` only). One accession
names one assembly, one call brings both files, and the same CLI emits the
`seq-report` an INSDC-accession assembly needs for its aliases. An FTP route pins a
set by species name, release and assembly version instead.

**Either way it is a build-time host**: `website/scripts/third-party-hosts.txt` (the
gated list of what a figure spec may fetch) carries neither, so figures, the weekly
sweep and tutorials read from jbrowse.org. Upstream availability affects only someone
re-running a build script.

Scripts that fetch from Ensembl, and which can switch:

- `build_orthofinder_synteny.sh`: `vertebrates` and `grasses` could switch. `wheat`
  cannot (NCBI names four of six assemblies differently; T. timopheevii
  GCA_963921465.1 has no NCBI annotation).
- `build_oat_homoeologs.sh`: no NCBI gene models for oat.
- `build_wheat_homoeologs.sh`: the calls are Ensembl Compara tables.
- `build_grape_peach_anchors.sh`: the clearest switch candidate; its sibling
  `build_grape_peach_cacao_synteny.sh` already fetches the same genomes from NCBI.
- `build_primate_selection.sh` and `build_scrna_pseudobulk.sh`: unchecked.

**Switching a working demo is not a swap of download lines**: different gene models
mean a new OrthoFinder or anchor run and a re-upload of every served file. Do it
while a script is changing for another reason.

## Format gotchas

- **A GDC MAF's `CONTEXT` column carries the indel anchor base** VCF needs (5 bases +
  REF + 5 bases, so `CONTEXT[5]`), so MAF-to-VCF needs no reference FASTA.
- **Don't hand-write a refNameAliases file for an INSDC-accession assembly.**
  `datasets download genome accession <GCA> --include seq-report`, then `dataformat
  tsv genome-seq --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name`
  gives the four columns `NcbiSequenceReportAliasAdapter` reads. Teaching the adapter
  `*_assembly_report.txt` was tried and reverted.
- **UCSC GenArk hubs are keyed on RefSeq accessions**, so a hub track drops into a
  config for the same assembly with no aliasing (the TAIR10 RepeatMasker bigBed's
  chroms are `NC_003070.9`). Check
  `https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.4/bbi/` before
  hosting your own for a non-model assembly.
- **MANE Select's symbol column is `geneSymbol`**, not `geneName2` (`bigBedInfo -as`).
  Filter on the accession (CDKN2A has two MANE entries); `labels: { name:
  "jexl:get(feature,'geneSymbol')" }` is a config slot, so it goes in the track's
  `displays`.
- **Don't take a repeat's identity from the Ensembl REST API**: it returned the right
  interval under a chr4 id on chr1 (`AT4TE22180`; TAIR10's own file says
  `AT1TE14315`), and it is flaky. Use the assembly's own annotation.

## "Make this figure on better data" is often a claim the data cannot make

Count before hunting for new data, and again before deleting a figure.
`multisv_rhd_dosage` wanted arcs over a deletion producing one spanning read pair
(NAHR between ~9 kb identical repeats aligns collinearly, so the band was RHD↔RHCE
paralogy, busiest in the 0/0 control). `alignments/strand_split_coverage` already
had dramatic strandedness in the frame at one column. Both ship a `website/scripts/`
script that prints the numbers. The converse also happened: the *depth* half of the
strand setting needed other data (three human cuts were one-sided or mostly intron),
and HSV-1 fixed both, found by counting the genome (74 genes in 152 kb on both
strands) rather than the reads.
