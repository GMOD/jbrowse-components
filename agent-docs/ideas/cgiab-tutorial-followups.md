---
name: cgiab-tutorial-followups
description: C-GIAB tutorial follow-ups, each needing data prep and an S3 upload, so none of them is sandbox-runnable.
---

# C-GIAB tutorial follow-ups (need data prep + S3 upload, not sandbox-runnable)

Deferred from the figure-accuracy pass, verified against the V0.5 benchmark
files + the data paper (McDaniel et al. 2025, _Sci Data_ 12:1195, DOI
10.1038/s41597-025-05438-2).

**Unused V0.5 fields.** VNTR/TR SVs and the `svviz2` per-dataset VAF fields are
loaded but never shown; either could carry a figure. When writing about
chromoplexy, note that the benchmark's `EVENT=cluster_3` (chr3/chr13, cited in
the translocation walkthrough) is **not** the chromoplexy example in Wagner et
al. 2026, which is a chr3/6/7/11 series forming three hybrid chromosomes.

**Single-cell WGS section.** C-GIAB publishes single-cell WGS for HG008-T via
BioSkryb ResolveDNA (PTA): 119 per-cell CRAMs (Ultima UG100, GRCh38, barcode in
filename) + per-cell VCFs, plus 8 clonal cell lines (`.../HG008/NIST/HG008-T_clones/`).
No ready-made per-cell CNV matrix — must derive from CRAMs. Result to show =
subclonal CNV heterogeneity (also the honest reason bulk allelic signals read
muted). **Option A (cleanest):** bin each of the 8 clones' bulk WGS to a
GC/mappability-corrected log2 bigWig (existing mosdepth + median-normalize
pipeline, 500 kb–1 Mb bins), stack as a multi-wiggle over `showAllRegions`.
**Option B:** same pipeline over the 119 per-cell CRAMs → clustered/pseudobulk
multi-wiggle (denser, low-depth — use ≥1 Mb bins). New spec
`sv_cgiab/single_cell_cnv`, placed right after "reading copy number" so
per-clone heterogeneity visualizes the subclonal-fraction explanation for why
SMAD4 reads muted vs TP53.
