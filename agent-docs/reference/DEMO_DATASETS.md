---
name: demo-datasets
description: The data behind the demos, figures and tutorials — which fixtures cover only one contig, which loci were picked by measurement and must not be re-picked by reputation, which candidate datasets were tried and rejected, which upstream a new demo's annotation should come from and which existing ones cannot move off Ensembl, where each pipeline's build scripts live, and the file-format gotchas that cost hours. Read before choosing a demo locus, swapping a dataset, picking an annotation source, or diagnosing a figure that renders empty.
audience: internal
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
- **One strain absent, the rest present → K12 `chr:501,500-539,000`** (the
  pggb `odgi pav` bigWigs). IAI39 reads 0.00 in all 75 windows, NCTC86 holds
  1.00 in every one, and CFT073 drops to 0 over `chr:523,000-530,000` and
  nowhere else in the band, which is the rhsD Rhs element; K12 carries ybaL
  through the allantoin operon across it. This is the band `pangenome/pav`
  shades, and it beats the two runs that are longer: `chr:1,489,500-1,533,000`
  (IAI39, 43.5 kb) is speckled, with Sakai and CFT073 each dropping out several
  times inside it, and `chr:4,496,500-4,536,500` and `chr:262,500-302,500` are
  the opposite figure, where every row goes white. By window count the genome is
  40% one-strain absences against 24% all-four, so "most troughs are
  K12-private" is false and only the DEEPEST ones are.
- **Strand-split coverage → HSV-1 `NC_001806.2:41,900-45,300` (UL21/UL22).**
  Two neighbouring viral genes on opposite strands at comparable depth: ~150
  reads a strand over its own gene against ~5 over its neighbour's. US9 against
  US10-US12 is the same flip an order of magnitude louder (1,079/10 then
  3/2,567) and is the wrong pick, because at 2,500 reads the pileup cannot be
  drawn and the figure is two bands with nothing under them.

- **Synteny against a real diploid → the `demos/hg002` mat-vs-pat chain.** Two
  loci out of it, both measured off the file rather than picked by reputation,
  and between them they cover what synteny code gets wrong:
  - **An inversion → `chr8_MATERNAL:7,822,846-11,688,252` against
    `chr8_PATERNAL:7,774,085-11,631,556`.** 3.87 Mb, the largest inverted block
    in the file (8p23.1), with collinear chains either side of both breakpoints
    — so one pan crosses from collinear into inverted and out again. Inside it
    maternal coordinates run BACKWARDS along paternal, which is the case that
    separates code handling strand from code that merely compiles.
  - **Hap-specific sequence → `chr8_MATERNAL:12,061,654-12,122,837`.** 61 kb
    covered by no chain at all, the largest such stretch on the maternal chr8.
    A window inside it is the "there is legitimately no answer" case, which
    otherwise only shows up as a feature that silently stops working.

  Two things about the data itself. The track is a **self-alignment** — both
  `assemblyNames` are `hg002v1.2`, one diploid assembly holding both haplotypes
  as `chr*_MATERNAL`/`chr*_PATERNAL` — so it exercises the paths that special-case
  a genome against itself. And **a `-` strand chain stores its query coordinates
  in reverse-complement space**: the header reads
  `chr8_PATERNAL - 135,155,257 139,012,728`, and the forward coordinates above are
  `qSize - qEnd .. qSize - qStart` against `qSize` 146,786,813. Reading those
  numbers as forward coordinates puts the inversion 127 Mb from where it is,
  which looks exactly like a translocation.

- **Sparse, short-block synteny → the `demos/grape_peach_cacao` MCScan track.**
  The opposite shape from every chain and PAF demo, and the one that exposes
  code assuming a window sits inside one alignment: whole-genome zoom loads
  ~1000 blocks, and the widest is 127 kb against a 27.8 Mb chromosome. It is
  what a follow-the-matching-region window-vs-block bug was found on.

  **Don't read a length ratio here as a bug.** These are GENE anchors, so the
  correspondence is legitimately many-to-one and legitimately non-proportional,
  and the ratios are large enough to look like arithmetic gone wrong. Measured
  at `NC_081805.1:5,000,000-5,200,000` (grape chr1): 11 blocks overlap, six
  separate grape genes (5,040,769 / 5,045,458 / 5,050,839 / 5,065,605 /
  5,072,407 / 5,085,527) all map to the SAME peach interval
  `NC_034009.1:31,382,557-31,384,385` — a tandem family collapsed onto one gene
  — and the one long block, grape 5,135,037-5,236,268, is 101 kb against 11 kb
  of peach. So 200 kb of grape corresponds to ~36 kb of peach and that is the
  data, not a mapping error.

  refNames are RefSeq accessions, not `chr1`/`Pp01`: grape chr1 is
  `NC_081805.1` (27.8 Mb), peach chr1 is `NC_034009.1` (47.9 Mb).

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
- **Great ape HSA16 all-vs-all** — the chr16 panel of Yoo et al. 2025, drawn
  there with SVbyEye plotAVA, as a six-row synteny stack. A build script for it
  landed and was removed again 2026-08-18 without ever emitting a PAF, so no
  figure, demo or doc cited it — `git show 17a7b2a4d5` is the pipeline. Three
  things it established, which is why the alignment half should not be
  re-derived from scratch:
  - **Getting the sequence is solved and cheap.** The HSA16-syntenic chromosome
    is chr18 in all five apes, named with the human synteny in it
    (`chr18_hap1_hsa16`), and GenomeArk ships `.fai`/`.gzi` beside each bgzipped
    FASTA — so each chromosome comes out by HTTP range request with no
    whole-genome download. Check the lengths against published values: a
    truncated range request still looks like valid FASTA.
  - **`--secondary=no` cannot combine with `-X`/`-P`.** Volume has to come from
    length-filtering the PAF afterwards, which is what SVbyEye's own `filterPaf`
    step does.
  - **`-c` with `-P` is what killed it.** SVbyEye's published all-vs-all
    parameters combine base-level alignment with retain-all-chains, and in ape
    satellite arrays that base-aligns every paralogous chain: 30 GB of RAM
    exhausted and 54 GB driven into swap without one row of output. minimap2's
    `-I` batches the target index and drops peak memory roughly in proportion,
    but nothing above 30 GB was ever tested. Dropping `-P` is the bigger lever
    and costs nothing here — SVbyEye's own pairwise recipe omits it, and the
    paralogous secondary chains it retains cannot appear in a synteny band
    anyway.

  So the open question is a machine, not a method. Note
  [ideas/synteny-comparative.md](../ideas/synteny-comparative.md) carries a
  *different* great-apes route — precomputed ntSynt synteny blocks — that needs
  no alignment run at all.

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
- **K562's BCR-ABL1 is ONE donor and 24 acceptors, not one junction.** Over the
  579 records `K562_isoseq.bam` returns for `chr22:23,286,000-23,293,000`, the
  BCR donor is essentially exact (23,290,412–23,290,415) while the chr9 side
  spreads over **24 distinct SA start positions**, 235 entries in all:
  130,780,369 carries **154**, 130,854,064 carries 26, then 130,763,193 (13),
  130,781,804 (10) and a tail. Twenty-three of the sites fall between
  130,731,760 and 130,885,834 — ~154 kb, inside ABL1 — and one singleton sits at
  128,691,170, about 2 Mb proximal and outside the gene. 130,854,064 is the ABL1
  exon-2 acceptor: the canonical e14a2 junction, the one the DepMap STAR-Fusion
  call reports and the one `cancer_sv/k562_bcr_abl_split` bands its right-hand
  chr9 panel on.

  **That figure frames the two biggest acceptors, a window each**, which is why
  it has three displayed regions rather than two: an interchromosomal connection
  draws as an arc only when both feet are on screen, so the FRAMING decides
  which junctions are arcs and which collapse into a tick at the donor. Any
  arc/tick count read off it is a statement about the framing as much as about
  the data — 169 of the 235 entries land in its middle window, 29 in its right
  one, and the 37 left over are what the tick still carries. The two-window
  version framed the 26 and hid the 154.

  Whether the 154 are an alternative acceptor or a recurrent alignment artefact
  is **not established**, and nothing in this file settles it. What can be said:
  they are a clean cluster — 151 distinct QNAMEs starting at one base, and 223
  of the 235 chr9 SA entries are `+`, where the acceptor foot IS the SA POS —
  landing where the RefSeq longest-isoform track draws bare ABL1 intron, with no
  annotated exon edge under it.

  An earlier version of this note blamed "100 kb+ `D` operations", and that is
  wrong in a way worth not repeating: the largest `D` op across all 579 records
  is **15 bp**. What these reads carry is long `N` (skip) operations, up to
  198 kb — which is what a spliced Iso-Seq alignment across ABL1's introns looks
  like, not evidence against one.

  Reproduce with `samtools view <url> chr22:23,286,000-23,293,000` and count
  `chr9,<pos>,` occurrences; no index-free download and no CIGAR walk needed.
  Every count above is that command's, so a re-run should reproduce them
  exactly.
- **Querying the tumour CRAM without downloading it** — its header `UR` is an
  absolute path on the submitter's cluster and `-T` against our hg38 fails, so
  use `required_fields` to skip SEQ, the only field CRAM needs the reference for:
  `samtools view --input-fmt-option required_fields=0x87F -F 1540 <url> <region>`.
- **Read-pair Hi-C heatmap** (Cue-style): bin ordinary paired-end WGS into a
  `.hic` contact matrix and each SV is an off-diagonal spot. Built from HG008-T
  Illumina 161x, using `samtools view -q20 -f65 -F2316` for one primary record
  per pair. The tutorial and its two build scripts were removed in
  `16250c4b58`, which is where the pipeline is if it is wanted again;
  `agent-docs/ideas/tutorial-ideas-audit.md` records why it went.

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
  satuRn stats written into a GENCODE GFF3, behind
  `website/docs/tutorials/dtu.md`. `scripts/build_dtu_demo.sh` rebuilds it from
  the ENCODE accessions up. Two traps it encodes: no transcript passes satuRn's
  **empirical** FDR on this contrast (min 0.97 across 39,596 tests, `locfdr`
  warning "f(z) misfit"), so the gate is `regular_FDR`; and the sample list is
  written out rather than re-derived from an ENCODE portal search, whose facets
  move. The eight RSEM quantifications are the statistic, the four bigWigs are
  one donor per tissue.

  **The hosted GFF3 carries the statistics on gene and transcript rows only**
  (`feature.parent.dif` reads them from the box) and no `Name=` (`labels.name`
  reads `gene_name`/`transcript_name`). The child copies came off the deployed
  bytes in place rather than by rerunning satuRn, checked by reading the
  before/after pair through `Gff3TabixAdapter` and comparing the color every box
  resolves. Only a rebuild would prove byte equality.
- **The `*.demo_slices.bam` files** — three region-sliced GIAB alignments (HG002
  ONT haplotagged, HG002 Illumina 2x250, HG008-T PacBio Revio), rebuilt by
  `scripts/build_demo_slices.sh`. **A sliced BAM records its own provenance**:
  `samtools view` writes its command line into an `@PG` line, so the source URL
  and the exact regions survive in the slice even when nothing else wrote them
  down. That is how these were recovered, and it is the first thing to try for
  any hosted BAM whose origin is unclear:

      samtools view -H <slice>.bam | grep -oE 'CL:samtools view -b -o .*'

  The two HG002 slices share one region set because the figures compare
  platforms at one locus; HG008 is GRCh38 and the others hs37d5, so the `chr`
  prefix differs by assembly rather than by mistake.

  **Cut each region wider than every window that displays its reads.** Depth
  inside a region is the source BAM's exactly, because a read covering a
  position inside the cut necessarily overlaps the cut and survives it. Outside
  one, depth decays over a read length — only the reads reaching back into the
  region are kept — and that decay is smooth, looks like coverage, and nothing
  in the app marks it as an edge. The HG008 chr3 region was once cut 18 kb short
  of a figure's window, which drew a coverage collapse over a breakend the full
  BAM shows a GAIN over; the fix was a wider region, not a narrower window. A
  slice whose regions match its windows exactly is already wrong at both edges.

  **A sliced track cannot back a genome-wide run**, which is worth knowing
  before reaching for one. `jb2export batch` over the HG008 benchmark SV callset
  renders ~150 junctions, and the reads track in `demos/cgiab/config.json` is
  this slice — so all but the handful on chr3, chr13 and chr9 come out as empty
  pileups, one per image, with the run reporting success. Point such a run at
  the full NCBI BAM instead: it is 118 GB but each junction is a range request,
  and rendering one is seconds.
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
- **HSV-1 long-read mRNA** (`demos/hsv1/`, `scripts/build_hsv1_demo.sh`) — RefSeq
  NC_001806.2 plus its NCBI genes and ERR2379735, one MinION run of
  poly(A)-selected HSV-1 mRNA from PRJEB25433. Hosted for the strand-split
  coverage figure and picked for a property that is the prep's, not the
  platform's: **read strand is transcript strand here, and is not in the same
  study's other nanopore run** (ERR2379736, randomly primed, 50/50 forward and
  reverse in every 2 kb window of the genome). 97% of the reads map to the
  virus. A 152 kb genome with 74 genes packed on both strands and essentially no
  splicing is what makes it the right shape for any figure about strand: the
  flip happens several times per screen and no part of the frame is intron.
- **rastair** methylation BED (TAPS / mod-C→T) is not modkit bedMethyl;
  detection keys on the `#`-header column names (`beta_est unmod mod coverage`),
  and `beta_est` is 0-1, scaled ×100 to match modkit.

## Where a new demo's annotation comes from: NCBI datasets, then Ensembl

**Default to `datasets download genome accession <acc> --include gff3,protein`.**
Seven build scripts already take that route and
`build_grape_peach_cacao_synteny.sh` is the worked multi-genome version, a short
name/accession table looped over. What makes it the default is that a set is
then pinned by accession: one identifier names one assembly, one call brings
both files, and the same CLI emits the `seq-report` an INSDC-accession assembly
needs for its aliases (see Format gotchas below). An FTP route composes a path
out of species name, release number and assembly-version string instead, so a
set is pinned by three moving parts rather than one.

**Either way it is a build-time host, which bounds what an upstream change can
break.** `website/scripts/third-party-hosts.txt` — the gated list of what a
figure spec may fetch from — carries neither, so the figures, the weekly sweep
and the tutorials all read from jbrowse.org. Availability upstream affects
someone re-running a build script and nothing a reader sees, which is why the
scripts below have not been rewritten for their own sake.

**Six scripts do fetch from it, and three of them cannot switch.** Checked
against the assemblies each one pins, so these are worth not re-checking:

- `build_orthofinder_synteny.sh` — `vertebrates` and `grasses` each have a
  RefSeq annotation on the same assembly (the ten accessions are listed in the
  script, checked 2026-08-03), so both could switch. `wheat` cannot: NCBI holds
  four of its six assemblies under names other than Ensembl's, and
  T. timopheevii (GCA_963921465.1) carries no NCBI annotation at all.
- `build_oat_homoeologs.sh` — NCBI carries gene models for no oat assembly.
- `build_wheat_homoeologs.sh` — the homoeolog calls are Ensembl Compara ortholog
  tables, which NCBI publishes no equivalent of.
- `build_grape_peach_anchors.sh` — the clearest switch candidate in the set. It
  pulls genome, CDS and GFF3 from Ensembl Plants 58, and its own sibling
  `build_grape_peach_cacao_synteny.sh` already fetches the same two genomes from
  NCBI (GCF_030704535.1, GCF_000346465.2).
- `build_primate_selection.sh` (Ensembl 116) and
  `build_scrna_pseudobulk.sh` (one `rest.ensembl.org/lookup/symbol` call) — not
  checked against NCBI either way.

**Switching a demo that works is not a swap of download lines.** Different gene
models mean a different OrthoFinder or anchor run and a re-upload of every file
the demo serves, so the time to do it is while a script is being changed for
another reason.

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

The converse also happened, on the review note directly after that one, and it
is why the rule is "count", not "don't look": the *depth* half of the same
setting really did need other data, and counting is what found it. Three human
cuts failed for two different measurable reasons — one-sided (alpha-globin,
10,153 forward against 224 reverse), or drawable but mostly intron (LUC7L
against FAM234A). HSV-1 fixed both, and the count that mattered was of the
genome rather than of the reads: 74 genes in 152 kb on both strands.
