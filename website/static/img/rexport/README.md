# R script export gallery

Figures produced by **View menu → "Export R script"**, which downloads a
self-contained `.R` that redraws the current view from source in pure
`rtracklayer` + `ggplot2` (no bespoke package — see `agent-docs/R_EXPORT.md`).
Every image below was rendered by running the *actual* generated script through
`Rscript` (against `test_data/volvox`, except Hi-C which uses the hg19
`extra_test_data/test.hic`).

## Wiggle — `LinearWiggleDisplay`

BigWig quantitative track: `geom_rect` bars over a `read_bigwig()` region.

![wiggle](./wiggle.png)

## Multi-wiggle — `MultiLinearWiggleDisplay`

Several BigWigs read into one long data.frame (`read_multibigwig()`), then drawn
in whichever mode the display is in.

Multi-row (`facet_grid(rows = vars(source))`, one colored row per source):

![multi-wiggle rows](./multiwiggle_rows.png)

Overlay (one panel, colored by source, with a legend):

![multi-wiggle overlay](./multiwiggle_overlay.png)

Density (per-source `scale_fill_viridis_c()` strip heatmap):

![multi-wiggle density](./multiwiggle_density.png)

## Alignments — `LinearAlignmentsDisplay`

BAM/CRAM as a `bam_coverage()` histogram panel plus a strand-colored pileup
whose rows come from `IRanges::disjointBins()`.

![alignments](./alignments.png)

## Genes — `LinearBasicDisplay`

GFF3 gene models: `geom_segment` bodies + `geom_rect` exon/CDS boxes, rows from
`gene_layout()`.

![genes](./genes.png)

## Variants — `LinearVariantDisplay`

VCF read over the tabix index with `read_vcf()` (Rsamtools `scanTabix`, no
VariantAnnotation dependency), each record a colored span + lollipop head keyed
on type (SNV / INS / DEL / MNV / SV subtype), rows from `vcf_layout()`.

![variants](./variants.png)

## Multi-sample variant matrix — `LinearMultiSampleVariantMatrixDisplay`

Per-sample genotypes read with `read_vcf_gt()` (Rsamtools `scanTabix`, no
VariantAnnotation), each cell classed ref / het / hom / other / no-call by
dosage of the site's most-frequent ALT. Samples (rows) are ordered by `hclust`
and a hand-rolled dendrogram (`dendro_segments()`) is composed as a left
patchwork panel; columns are laid out by site index (matching JBrowse's matrix,
not genomic position). MAF and missingness floors are emitted as editable script
variables. Shown on the 1094-sample volvox 1000G simulation.

![variant matrix](./variant_matrix.png)

The matrix stacks with ordinary 1-D genomic tracks in one `plot_region()` call —
here the `plugins/canvas` gene track (`LinearBasicDisplay`, `read_gff()` +
`gene_layout()`) over the 20-sample `volvox.sv.vcf.gz` structural-variant matrix
on `ctgA:1,000-24,000`. The gene panel is drawn in genomic-position space while
the matrix columns are site indices, so the two x-axes deliberately don't line
up (the matrix is compact, not to genomic scale).

![variant matrix over a gene track](./variant_matrix_genes.png)

## Hi-C — `LinearHicDisplay`

Contact matrix read with `read_hic()` (`strawr::straw`, the reader from the
`.hic` authors), straw's upper triangle mirrored across the diagonal, drawn as a
square `geom_raster` heatmap with `coord_fixed()` and a log-scaled
`scale_fill_viridis_c()`. Bin size and normalization are emitted as visible
script variables you can edit.

![hi-c](./hic.png)

## Combined figure

Every track in the view stacks into one `patchwork` figure sharing an x-range,
so `plot_region(chrom, start, end)` redraws the whole panel for any locus (loop
it over a BED file for batch figures).

![combined](./combined.png)
