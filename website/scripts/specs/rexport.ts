import type { RExportSpec } from '../screenshot-spec-types.ts'

// The "Export R script" gallery: for each figure, the SAME session an existing
// browser figure already shows, re-rendered through the real exporter —
// `jb2export --config … --session … --out <tmp>.R`, then Rscript.
//
// Every spec here names another spec (`from`) rather than carrying a dataset of
// its own, so each R figure is the direct counterpart of a JBrowse rendering of
// the identical view. That is the comparison a reader actually wants ("what does
// this track look like in ggplot2?"), and it keeps the R gallery on the datasets
// the docs already explain rather than on a parallel set of examples.
//
// It also removes a class of drift: retargeting a browser figure retargets its R
// twin, and deleting one is a validateSpecs failure rather than a stale render.
// Before this, these 19 figures were hand-made PNGs force-added past
// .gitignore, absent from figures.lock, and reproducible only from prose.
function rexportSpec(
  name: string,
  from: string,
  extra: Partial<RExportSpec> = {},
): RExportSpec {
  return { mode: 'rexport', name: `rexport/${name}`, from, ...extra }
}

// Bioconductor readers, by track type. Named per spec so a machine without the
// full stack skips the figures it cannot draw and says which package is missing,
// instead of failing the sweep.
const BIGWIG = ['rtracklayer']
const BAM = ['Rsamtools', 'GenomicAlignments']
const TABIX = ['Rsamtools']

export const rexportSpecs: RExportSpec[] = [
  // ── Quantitative ────────────────────────────────────────────────────────
  // The multi-wiggle renderer comparison: several BigWigs read into one long
  // data.frame, drawn in whichever mode the display is in.
  rexportSpec('multiwiggle', 'multiwig/multi_renderer_types', {
    rPackages: BIGWIG,
  }),

  // ── Alignments ──────────────────────────────────────────────────────────
  // A coverage histogram over a strand-colored pileup, the default alignments
  // view. Deliberately a BAM source rather than one of the CRAM figures: the
  // CRAM path shells out to samtools to decode a temp BAM (Rsamtools is
  // BAM-only) and needs the reference too, which is a lot to ask of a docs
  // regen — jb2export can still do it, and exportRRun covers it.
  rexportSpec('alignments', 'display_type_default_badge', { rPackages: BAM }),

  // Sort by base at a SNP: reads carrying the alternate allele group at the
  // top, which is the whole point of the localized sort.
  rexportSpec('alignments_sort', 'alignments_sort_by_base', { rPackages: BAM }),

  // Long reads across an insertion: the CIGAR walk that draws deletions,
  // skipped introns and insertion ticks over the read body.
  rexportSpec('long_reads', 'read_vs_ref_insertion', { rPackages: BAM }),

  // ── Genes ───────────────────────────────────────────────────────────────
  rexportSpec('genes', 'customized_feature_details', { rPackages: BIGWIG }),

  // ── Variants ────────────────────────────────────────────────────────────
  rexportSpec('variants', 'volvox_variants', { rPackages: TABIX }),

  // The multi-sample matrix: site-indexed columns, samples ordered by hclust
  // with a hand-rolled dendrogram composed as a left panel.
  rexportSpec('variant_matrix', 'variants/cluster_dialog', {
    rPackages: TABIX,
  }),

  // ── Hi-C ────────────────────────────────────────────────────────────────
  // strawr rotates the contact matrix into the triangular view on a genomic
  // x-axis, so it stacks under the gene track the source figure shows.
  rexportSpec('hic', 'hic/percentile_on', { rPackages: ['strawr'] }),

  // Two discontiguous regions concatenated on one cumulative-bp axis — the
  // multi-region layout, with the Hi-C panel spanning the divider.
  rexportSpec('multiregion', 'hic/two_regions', { rPackages: ['strawr'] }),

  // ── GWAS ────────────────────────────────────────────────────────────────
  rexportSpec('gwas', 'gwas/manhattan', { rPackages: TABIX }),

  // ── Figures the gallery already curates ─────────────────────────────────
  // Everything below re-exports a reviewed gallery/topic figure, so the R
  // rendering can be compared against a JBrowse one a reader has already seen.

  // Polyprotein cleavage products as nested gene glyphs — the densest feature
  // layout in the set, and a good test of gene_layout's row packing.
  rexportSpec('genes_sarscov2', 'gallery/sarscov2_polyprotein', {
    rPackages: BIGWIG,
  }),

  // The same idea across two loci at once — a multi-region scATAC figure, which
  // is the multi-region layout doing real work rather than demonstrating itself.
  rexportSpec('scatac_multiregion', 'scatac/pbmc5k_marker_swap', {
    rPackages: BIGWIG,
  }),

  // A phased trio genotype matrix: each sample expanded into its two
  // haplotypes, which is the one case the matrix colours per allele.
  rexportSpec('trio_phased', 'trio-matrix-phased-clean', {
    rPackages: [...TABIX, ...BIGWIG],
  }),
]
