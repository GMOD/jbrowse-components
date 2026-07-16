import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  vcfGzLocation?: { uri?: string }
  uri?: string
}

export interface VariantRowRParams {
  trackId: string
  trackName: string
  uri: string
  // minor-allele-frequency floor / max no-call fraction (the display's config
  // slots), emitted as editable script variables
  minMaf: number
  maxMissing: number
  // renderingMode === 'phased': one row per haplotype ("<sample> HP<n>") classed
  // ref/alt/other, instead of one collapsed row per sample classed ref/het/hom
  phased: boolean
}

/**
 * Pure builder for the R panel of the (non-matrix) multi-sample variant display:
 * one genotype row per sample (or per haplotype in phased mode), each variant
 * drawn at its honest genomic position (unlike the matrix's site-index columns).
 * Reuses the inline `read_vcf_gt()` reader (Rsamtools scanTabix, no
 * VariantAnnotation) and its cell classing; rows stay in VCF order (no
 * clustering). Single-base sites get a floor width so they stay visible. Reads
 * every region in the view per region and lays them onto one cumulative-bp
 * x-axis (JBrowse's multi-region view); the sample rows are shared across
 * regions, and the shared axis + dividers come from plot_regions().
 */
export function variantRowFragment(p: VariantRowRParams): RTrackFragment {
  const v = safeVarName(p.trackId)
  const levels = p.phased
    ? `c("ref", "alt", "other", "nocall")`
    : `c("ref", "het", "hom", "other", "nocall")`
  const pal = p.phased
    ? `c(ref = "#cccccc", alt = "#377eb8", other = "#e41a1c", nocall = "#f2f2b3")`
    : `c(ref = "#cccccc", het = "#6699cc", hom = "#265973", other = "#660000", nocall = "#f2f2b3")`
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['Rsamtools', 'GenomicRanges', 'ggplot2'],
    helpers: ['read_vcf_gt'],
    setup: `${v} <- ${rStr(p.uri)}
${v}_min_maf <- ${p.minMaf}        # drop sites below this minor-allele frequency
${v}_max_missing <- ${p.maxMissing}    # drop sites with more than this no-call fraction`,
    plotVariable: `p_${v}`,
    heightWeight: 3,
    // read each region's genotypes, filter, and place the passing sites onto the
    // cumulative-bp axis; sample rows (from the VCF header) are shared, so a
    // region with no passing sites still contributes no rows
    plotExpr: `{
  gts <- lapply(seq_len(nrow(regions)), function(ri)
    read_vcf_gt(${v}, regions$chrom[ri], regions$start[ri], regions$end[ri], ${p.phased ? 'TRUE' : 'FALSE'}))
  samples <- gts[[1]]$samples
  ns <- length(samples)
  lev <- rev(samples)             # draw the first VCF sample/haplotype at the top
  minw <- (max(regions$cum_end) - min(regions$offset)) / 400  # floor width for single-base sites
  parts <- lapply(seq_along(gts), function(ri) {
    gt <- gts[[ri]]
    keep <- gt$has_alt & gt$maf >= ${v}_min_maf & gt$missingness <= ${v}_max_missing
    if (!any(keep)) return(NULL)
    cls <- gt$cls[keep, , drop = FALSE]
    vstart <- gt$start[keep]; vend <- gt$end[keep]
    shift <- regions$offset[ri] - regions$start[ri]
    long <- as.data.frame.table(cls, responseName = "class", stringsAsFactors = FALSE)
    names(long)[1:2] <- c("site", "sample")
    si <- as.integer(long$site)
    long$xmin <- pmin(pmax(vstart[si], regions$start[ri]), regions$end[ri]) + shift
    long$xmax <- pmax(pmin(pmax(vend[si], regions$start[ri]), regions$end[ri]) + shift, long$xmin + minw)
    long
  })
  long <- do.call(rbind, parts)
  if (is.null(long)) long <- data.frame(sample = character(), class = character(),
    xmin = numeric(), xmax = numeric(), stringsAsFactors = FALSE)
  long$yy <- match(long$sample, lev)
  long$class <- factor(long$class, levels = ${levels})
  pal <- ${pal}
  ggplot(long) +
    geom_rect(aes(xmin = xmin, xmax = xmax, ymin = yy - 0.5, ymax = yy + 0.5, fill = class)) +
    scale_fill_manual(values = pal, drop = FALSE, name = "Genotype") +
    scale_y_continuous(breaks = seq_len(ns), labels = lev, expand = c(0, 0)) +
    labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
    theme_minimal() +
    theme(axis.text.y = if (ns > 60) element_blank() else element_text(size = 6),
          panel.grid = element_blank())
}`,
  }
}

/** Read the variant display's source uri + filters into an R fragment. */
export function exportRCode(
  self: LinearMultiSampleVariantDisplayModel,
): RTrackFragment {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  return variantRowFragment({
    trackId,
    trackName,
    uri: firstUri(adapter.vcfGzLocation?.uri, adapter.uri),
    minMaf: self.minorAlleleFrequencyFilter,
    maxMissing: self.maxMissingnessFilter,
    phased: self.renderingMode === 'phased',
  })
}
