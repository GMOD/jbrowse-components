# C-GIAB tutorial follow-ups (planning)

Two larger items deferred from the figure-accuracy pass (2026-07-10). Both need
data prep + upload to `s3://jbrowse.org/demos/cgiab/`, so neither is runnable in
the screenshot sandbox. Verified against the actual V0.5 benchmark files and the
data paper (McDaniel et al. 2025, _Sci Data_ 12:1195, DOI
10.1038/s41597-025-05438-2) + the "complete human pancreatic cancer genome"
preprint.

## 1. V0.4 → V0.5 benchmark upgrade

V0.5 (2026-03-18) is the current somatic SV+CNV benchmark; the tutorial loads
V0.4 (2025-07-14). The gene-level CN/haplotype states are **unchanged** in V0.5
(CDKN2A CN0; TP53 = CNA_20, 1+0; chr17q = CNA_21, 2+0; SMAD4 = CNA_48, 0+1;
KRAS = SV_101, 2+1), so all walkthrough biology holds. What changes:

- **Load URLs** — swap the V0.4 paths for the V0.5 dir:
  `.../HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/`
  (benchmark VCF + CNV `calls.bed`). Touch: tutorial "Load the C-GIAB benchmark"
  commands, `cgiab-demo-config.json`, and any V0.4 URL in `specs/sv.ts`.
- **Re-confirm call IDs** against the V0.5 VCF/BED before updating prose +
  spec `readyText`/search terms: SV_20/SV_190 (chr3-chr13 BND), SV_85 (CUZD1
  DEL), SV_75 (CDKN2A), SV_101 (KRAS), CNA_20/21/48. IDs can renumber between
  benchmark versions.
- **New in V0.5**: confident subclonal SVs (VAF>5%) promoted to PASS, VNTR/TR
  SVs, an `svviz2` VAF field. `EVENTTYPE=CHROMOPLEXY` is explicit — the
  chr3-chr13 fusion is `cluster_3`. Worth one line in the translocation
  walkthrough (the genome is chromoplexy-driven).
- The demo-bucket log2/BAF/CNV bigWigs don't need regenerating (the CN states
  and het SNP set are materially the same); only the benchmark VCF/BED tracks
  move to V0.5.

## 2. Single-cell WGS section

C-GIAB publishes single-cell WGS for HG008-T via **BioSkryb ResolveDNA** (PTA):

- **119 per-cell CRAMs** (Ultima UG100, GRCh38-aligned, cell barcode in the
  filename) + per-cell VCFs, individually addressable. Manifest:
  `.../HG008/Liss_lab/HG008-T_bioskryb-libraries-UG100/giab-aws_HG008-bioskryb-ultima_data_manifest.tsv`
- 120-cell Illumina ResolveDNA — bundled `.tar.gz`, not directly loadable.
- **8 clonal cell lines** (bulk WGS of single-cell-derived colonies):
  `.../HG008/NIST/HG008-T_clones/`

There is **no** ready-made per-cell CNV matrix or bigWig — it must be derived
from the CRAMs. The result to show is **subclonal CNV heterogeneity** (also the
honest explanation for the muted bulk allelic signals corrected in the main
tutorial). Options, increasing effort:

- **Option A — 8 clonal lines (cleanest).** Bin each clone's bulk WGS to a
  GC/mappability-corrected log2-ratio bigWig (the tutorial's existing
  mosdepth + median-normalize pipeline, 500 kb–1 Mb bins), stack as a
  multi-wiggle (one row per clone) over `showAllRegions`. ~8 high-coverage rows,
  reads clearly, shows CNV segregating across clones. Reuses the log2 +
  multi-wiggle machinery already in the tutorial.
- **Option B — true single-cell.** Same bin→bigWig pipeline over the 119 per-cell
  CRAMs → a 119-row (or clustered/pseudobulk) multi-wiggle. More authentic but
  dense, and single-cell WGS depth is low — use ≥1 Mb bins and expect noise.
  Parallels the existing scATAC-pseudobulk tutorial.

Data prep is heavy (download CRAMs, bin, normalize, upload bigWigs) — same class
as the Wakhan/mosdepth steps, not sandbox-runnable. New spec:
`sv_cgiab/single_cell_cnv`, a multi-wiggle over `showAllRegions` styled like
`cnv_log2ratio_genome`. Place the section right after "reading copy number" so
the per-clone/per-cell heterogeneity visualizes the subclonal-fraction
explanation for why SMAD4 reads muted vs TP53.
