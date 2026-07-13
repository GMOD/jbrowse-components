import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearMultiSampleVariantMatrixDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  vcfGzLocation?: { uri?: string }
  uri?: string
}

function safeVarName(str: string) {
  return str.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

function rStr(s: string) {
  return `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export interface VariantMatrixRParams {
  trackId: string
  trackName: string
  uri: string
  // minor-allele-frequency floor / max no-call fraction (the display's config
  // slots), emitted as editable script variables
  minMaf: number
  maxMissing: number
}

/**
 * Pure builder for the R panel of a multi-sample variant matrix. Reads per-
 * sample genotypes with the inline `read_vcf_gt()` helper (Rsamtools scanTabix,
 * no VariantAnnotation), classes each cell ref/het/hom/other/nocall by dosage of
 * the site's most-frequent ALT, orders samples by `hclust`, and draws a
 * `geom_tile` heatmap with columns laid out by site index (matching JBrowse's
 * matrix layout, not genomic position). A hand-rolled dendrogram
 * (`dendro_segments()`) is composed as a left patchwork panel. MAF / missingness
 * filters are emitted as visible thresholds the user can edit. Reads `chrom`,
 * `start`, `end` from the enclosing `plot_region()`.
 */
export function variantMatrixFragment(p: VariantMatrixRParams): RTrackFragment {
  const v = safeVarName(p.trackId)
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['Rsamtools', 'GenomicRanges', 'ggplot2', 'patchwork'],
    helpers: ['read_vcf_gt', 'dendro_segments'],
    setup: `${v} <- ${rStr(p.uri)}
${v}_min_maf <- ${p.minMaf}        # drop sites below this minor-allele frequency
${v}_max_missing <- ${p.maxMissing}    # drop sites with more than this no-call fraction`,
    plotVariable: `p_${v}`,
    heightWeight: 6,
    plotExpr: `{
  gt <- read_vcf_gt(${v}, chrom, start, end)
  keep <- gt$has_alt & gt$maf >= ${v}_min_maf & gt$missingness <= ${v}_max_missing
  cls <- gt$cls[keep, , drop = FALSE]
  dose <- gt$dose[keep, , drop = FALSE]
  # cluster samples (columns) into a row order; needs >2 samples and >0 sites
  hc <- if (ncol(dose) > 2 && nrow(dose) > 0)
    hclust(dist(t(replace(dose, is.na(dose), 0)))) else NULL
  ord <- if (is.null(hc)) seq_along(gt$samples) else hc$order
  long <- as.data.frame.table(cls, responseName = "class", stringsAsFactors = FALSE)
  names(long)[1:2] <- c("site", "sample")
  long$site <- factor(long$site, levels = rownames(cls))
  long$sample <- factor(long$sample, levels = gt$samples[ord])
  long$class <- factor(long$class, levels = c("ref", "het", "hom", "other", "nocall"))
  pal <- c(ref = "#cccccc", het = "#6699cc", hom = "#265973", other = "#660000", nocall = "#f2f2b3")
  tiles <- ggplot(long, aes(site, sample, fill = class)) +
    geom_tile() +
    scale_fill_manual(values = pal, drop = FALSE, name = "Genotype") +
    scale_y_discrete(expand = expansion(add = 0.5)) +
    labs(title = ${rStr(p.trackName)}, x = "variant site (column index)", y = NULL) +
    theme_minimal() +
    theme(axis.text.x = element_blank(), axis.ticks.x = element_blank(),
          axis.text.y = if (ncol(cls) > 60) element_blank() else element_text(size = 6),
          panel.grid = element_blank())
  if (is.null(hc)) tiles else {
    seg <- dendro_segments(hc)
    dendro <- ggplot(seg) +
      geom_segment(aes(x = x, y = y, xend = xend, yend = yend), linewidth = 0.2) +
      scale_x_reverse() +
      scale_y_continuous(limits = c(0.5, length(gt$samples) + 0.5), expand = c(0, 0)) +
      theme_void()
    wrap_elements((dendro | tiles) + plot_layout(widths = c(1, 5)))
  }
}`,
  }
}

/** Read the variant matrix display's source uri + filters into an R fragment. */
export function exportRCode(
  self: LinearMultiSampleVariantMatrixDisplayModel,
): RTrackFragment {
  const track = getContainingTrack(self)
  const trackId: string = track.configuration.trackId
  const adapter: AdapterConf = getConf(track, 'adapter')
  return variantMatrixFragment({
    trackId,
    trackName: getConf(track, 'name') || trackId,
    uri: adapter.vcfGzLocation?.uri ?? adapter.uri ?? '',
    minMaf: self.minorAlleleFrequencyFilter,
    maxMissing: self.maxMissingnessFilter,
  })
}
