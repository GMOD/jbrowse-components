---
name: cgiab-tutorial-followups
description: C-GIAB tutorial follow-ups, each needing data prep and an S3 upload, so none of them is sandbox-runnable.
---

# C-GIAB tutorial follow-ups (need data prep + S3 upload, not sandbox-runnable)

Deferred from the figure-accuracy pass, verified against the V0.5 benchmark
files + the data paper (McDaniel et al. 2025, _Sci Data_ 12:1195, DOI
10.1038/s41597-025-05438-2).

**Unused V0.5 fields — done.** Both went in together, under the tutorial's "A
tandem-repeat call, sized against the normal": `sv_cgiab/vntr_tumor_normal` is
SV_223, the V0.5 README's own worked example of an `EVENTTYPE=CNV:TR` record, at
base level over both published BAMs, and the section spends `SVVIZ_VAF_ALL` and
`SVVIZBYDATASET` beside it. The pairing is what made it worth a section rather
than two: the four datasets' VAFs disagree end to end at that locus, the field's
header says TRs are where it is biased, and the pileup shows the mechanism.

The reads were counted before the figure was framed
(chr5:165,755,113-165,755,183): normal 12/38 reads carry a 42 bp insertion,
tumour 38/42 carry a 28 bp deletion, neither sample carries the other's allele.
That the called span is *wider* than the deletion under it is the point of the
figure, not a mis-framing — `SVLEN` is the germline-to-tumour distance.

The figure reads the published FTP BAMs rather than `HG008_T_PACBIO_BAM`: the
demo slice has no read there, and the 26 MB BAI that slice exists to avoid costs
3.3 s measured, which one 400 bp window can pay. A fourth region cut into a
slice six other figures load is the larger risk.

**Still open on the same file.** When writing about chromoplexy, note that the
benchmark's `EVENT=cluster_3` (chr3/chr13, cited in the translocation
walkthrough) is **not** the chromoplexy example in Wagner et al. 2026, which is
a chr3/6/7/11 series forming three hybrid chromosomes.

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
