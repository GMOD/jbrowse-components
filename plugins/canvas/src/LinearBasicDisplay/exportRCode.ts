import { firstUri, getTrackRMeta, rStr, safeVarName } from '@jbrowse/plugin-linear-genome-view'

import type { LinearBasicDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  gffGzLocation?: { uri?: string }
  gffLocation?: { uri?: string }
  bedGzLocation?: { uri?: string }
  bedLocation?: { uri?: string }
  uri?: string
}

export interface GeneRParams {
  trackId: string
  trackName: string
  uri: string
}

/**
 * Pure builder for the R panel of a GFF3 feature/gene track, using plain
 * ggplot2 (no bespoke package): each top-level feature is a `geom_segment`
 * body line, its leaf subfeatures (exons/CDS/UTRs) are `geom_rect` boxes, and
 * rows come from the visible, swappable `gene_layout()` helper. The panel reads
 * `chrom`, `start`, `end` from the enclosing plot_region().
 */
export function geneFragment(p: GeneRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const strandColors =
    'c(`+` = "#5a9bd4", `-` = "#e8894a", `*` = "grey50")'
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['rtracklayer', 'ggplot2'],
    helpers: ['read_gff', 'gene_layout', 'bp_axis'],
    setup: `${pathVar} <- ${rStr(p.uri)}`,
    plotVariable: `p_${pathVar}`,
    heightWeight: 2,
    plotExpr: `ggplot(gene_layout(read_gff(${pathVar}, chrom, start, end))) +
  geom_segment(data = function(d) d[is.na(d$parent), ],
    aes(x = start, xend = end, y = row, yend = row, color = strand)) +
  geom_rect(data = function(d) d[!(d$fid %in% d$parent), ],
    aes(xmin = start, xmax = end, ymin = row - 0.3, ymax = row + 0.3, fill = strand)) +
  geom_text(data = function(d) d[is.na(d$parent), ],
    aes(x = (start + end) / 2, y = row + 0.5, label = name), size = 2.5, na.rm = TRUE) +
  scale_fill_manual(values = ${strandColors}, guide = "none") +
  scale_color_manual(values = ${strandColors}, guide = "none") +
  scale_y_reverse() +
  coord_cartesian(xlim = c(start, end)) +
  bp_axis() +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`,
  }
}

/** Read the feature track's source uri into an R gene-model panel. */
export function exportRCode(self: LinearBasicDisplayModel): RTrackFragment {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  return geneFragment({
    trackId,
    trackName,
    uri: firstUri(
      adapter.gffGzLocation?.uri,
      adapter.gffLocation?.uri,
      adapter.bedGzLocation?.uri,
      adapter.bedLocation?.uri,
      adapter.uri,
    ),
  })
}
