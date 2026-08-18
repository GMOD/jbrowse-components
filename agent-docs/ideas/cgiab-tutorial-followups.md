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
muted).

**Option A is done** and it went in as a per-clone BED rather than a
multi-wiggle: the 8 clones' CNVkit calls are one `LinearMultiRowFeatureDisplay`
partitioned on a `clone` column (`hg008_subclonal_cnv` in the demo config,
`HG008T-clones.cnv.multirow.bed.gz`), and the figure is
`sv_cgiab/subclonal_cnv` under the tutorial's "Subclonal copy number". It sits
on chr3p rather than over `showAllRegions`: at whole-genome zoom the one clone
that departs is a few pixels wide and the eight rows read as a solid block.
Reading a departure needs care — CNVkit centres each clone on its own median
and this genome is hypodiploid, so most row-to-row disagreement in that file is
the centring. The spec comment carries the scan that picked chr3p.

**Option B (the 119 per-cell CRAMs)** is still open: same pipeline →
clustered/pseudobulk multi-wiggle, denser and low-depth, so ≥1 Mb bins. It
would say something the clone rows cannot, which is how many cells carry a
subclone rather than how many cultures.
