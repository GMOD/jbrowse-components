# Handoff — regenerate cgiab somatic-CNV demo data (for the `ada` agent)

You are running on the `ada` server where the HG008 cgiab data + tooling live
(`~/cgiab`). Goal: produce a small set of CNV/BAF/coverage tracks for the HG008
tumor-vs-normal demo and upload them to `s3://jbrowse.org/demos/cgiab/`, so four
JBrowse doc screenshots can be fixed. You do **not** need the jbrowse-components
repo — just produce the files listed under "Deliverables" and report back the
exact URLs + any format notes.

## Why (what's wrong today)

The current demo plots two **indexcov** bigWigs that are each independently
median-normalized, so tumor and normal share no common baseline; and the BAF is
raw (needs min/avg/max whiskers to show LOH). Reviewers asked for:

- a proper **tumor/normal log2 ratio** (common baseline),
- a **clean BAF** that shows LOH as a single per-bin value (no whiskers) —
  ideally **haplotype-phased** BAF,
- **fine / per-base coverage** near a small deletion (current bins too coarse),
- copy-number **segments** carrying total + per-haplotype copy number.

## Preferred tool: Wakhan

Run **Wakhan** (https://github.com/KolmogorovLab/Wakhan), the Kolmogorov Lab
haplotype-specific long-read CNV caller. One run on the phased HG008 **tumor**
BAM (phased against the germline hets, with the normal as reference) emits
everything above in one shot: per-bin (and fine) coverage, haplotype-specific
copy-number segments, and phased (already-folded) BAF. If `~/cgiab` already has
a Wakhan run or a driver script, reuse it. Inputs it needs, locate them in
`~/cgiab`:

- HG008 **tumor** long-read BAM aligned to `GRCh38_GIABv3` (phased; if not
  phased, phase with the germline het VCF via `whatshap`/`longphase`)
- HG008 **normal** BAM (for the tumor/normal ratio + germline hets)
- `GRCh38_GIABv3.fa` (+ `.fai`)
- germline/benchmark VCF for het SNP sites

A hand-rolled `mosdepth`/`bcftools` fallback (exact awk formulas for log2
ratio + folded BAF) is in `cnv-data-recipe.md` if Wakhan isn't usable.

## Deliverables (upload all to `s3://jbrowse.org/demos/cgiab/`)

Keep the existing filenames where a figure already references them; add the new
ones. All bigWigs made with `bedGraphToBigWig <bg> GRCh38_GIABv3.fa.fai <out>`.

- **`HG008_log2ratio.bw`** — genome-wide log2(tumor/normal) coverage ratio,
  ~10kb bins. (Already referenced; regenerate cleanly if the current one is
  indexcov-derived.) Fixes `cnv_multi_bigwig`, feeds `cnv_log2_baf` /
  `cnv_log2ratio_genome` / `driver_chr17_loh`.
- **`HG008-T_baf_folded.bw`** — folded/phased BAF: one value per het bin where 0
  = balanced (het ≈ 0.5) and 0.5 = full skew (LOH). This is the key new file —
  it lets the BAF panel drop the min/avg/max whiskers (plot with
  `summaryScoreMode:'avg'`, domain `0..0.5`). Fixes `cnv_log2_baf` +
  `cnv_log2ratio_genome`. (Wakhan's phased BAF is ideal here.)
- **`HG008-T_coverage_perbase.bw`** (or a fine ~100–500bp-bin bigWig) covering
  at least `chr9:21,900,000–22,020,000` (CDKN2A) — fine enough to show the
  small-scale deletion. Fixes `driver_cdkn2a_deletion`. A whole-genome fine
  bigWig is fine too if size is acceptable.
- **CN segments BED** — if Wakhan's segments differ from the existing
  `GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls.bed`, emit a BED
  with a `#`-comment header naming the columns exactly:
  `#chr  start  end  total_copy_number  hap1_copy_number  hap2_copy_number  name`
  (tab-separated). JBrowse's BedAdapter reads that header to expose the columns,
  and a label jexl already renders `CN <total> (<hap1>|<hap2>)`. Name it
  `HG008-T_wakhan_cnv.bed` (bgzip+tabix optional). Only needed if you improve on
  the current calls; otherwise the existing BED stays.

## Report back

For each file: the final `https://jbrowse.org/demos/cgiab/<name>` URL, the bin
size, the score domain (min/max), and — for the folded BAF — confirm 0 =
balanced / 0.5 = LOH. The jbrowse-side agent will then swap the indexcov
subadapters for `HG008_log2ratio.bw`, point the BAF tracks at
`HG008-T_baf_folded.bw` with `summaryScoreMode:'avg'`, point
`driver_cdkn2a_deletion` at the fine-coverage bigWig, regenerate the four
screenshots, and flip their review entries to good.
