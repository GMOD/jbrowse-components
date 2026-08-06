The [Pan-UK Biobank](https://pan.ukbb.broadinstitute.org/) GWAS across its full
phenotype catalog. The search box filters a trimmed copy of the official
manifest; picking a phenotype loads that trait's tabix-indexed summary
statistics from the Pan-UKBB public S3 bucket as a Manhattan plot. The
**Population** dropdown switches which column drives it — the cross-ancestry
meta-analysis, or any single ancestry the trait was actually run in.

Each phenotype is one `GWASTrack` over a `GWASAdapter`. Pan-UKBB's flat files
expose `neglog10_pval_*` columns that are already −log₁₀(p), so the adapter
reads the selected column directly (`scoreTransform: 'none'`, the default).
Where a p-value column is untransformed, `scoreTransform` takes `negLog10` for a
raw p-value or `negLog10FromLn` for a natural-log one. The transform runs
natively per feature, so it stays fast genome-wide.

Featured phenotypes open zoomed to a known lead locus; anything else opens on
chromosome 1. For LD-colored Manhattan plots see
[LocusZoom-style LD](../locus-zoom-ld/), and the
[GWAS track guide](https://jbrowse.org/jb2/docs/config_guides/gwas_track/) for
setup.
