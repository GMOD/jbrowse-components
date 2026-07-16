import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

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
  /** 'bed' selects the read_bed reader; anything else parses the uri as GFF3. */
  format?: 'gff' | 'bed'
}

/**
 * Pure builder for the R panel of a feature/gene track, using plain ggplot2 (no
 * bespoke package): each top-level feature is a directional `geom_segment` body
 * line, its leaf subfeatures are `geom_rect` boxes — thin exons/UTRs under thick
 * CDS, keyed off the feature `type` so coding regions read like the browser
 * glyph — and rows come from the visible, swappable `gene_layout()` helper. GFF3
 * and BED both feed the same panel via read_gff / read_bed (identical schema).
 * `read_regions()` reads each region in the view onto one cumulative-bp x-axis
 * (features are cut at the region edge); the shared axis + dividers come from
 * plot_regions(). gene_layout runs over the combined regions so rows pack across
 * the whole figure.
 */
export function geneFragment(p: GeneRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const reader = p.format === 'bed' ? 'read_bed' : 'read_gff'
  const strandColors = 'c(`+` = "#5a9bd4", `-` = "#e8894a", `*` = "grey50")'
  const data = `gene_layout(read_regions(function(chrom, start, end) ${reader}(${pathVar}, chrom, start, end), regions, c("start", "end")))`
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['rtracklayer', 'ggplot2'],
    helpers: [reader, 'gene_layout'],
    setup: `${pathVar} <- ${rStr(p.uri)}`,
    plotVariable: `p_${pathVar}`,
    heightWeight: 2,
    plotExpr: `ggplot(${data}) +
  geom_segment(data = function(d) d[is.na(d$parent), ],
    aes(x = ifelse(strand == "-", end, start), xend = ifelse(strand == "-", start, end),
      y = row, yend = row, color = strand),
    linewidth = 0.3, arrow = arrow(length = unit(0.05, "inches"), type = "closed")) +
  geom_rect(data = function(d) d[!(d$fid %in% d$parent) & d$type != "CDS", ],
    aes(xmin = start, xmax = end, ymin = row - 0.18, ymax = row + 0.18, fill = strand)) +
  geom_rect(data = function(d) d[d$type == "CDS", ],
    aes(xmin = start, xmax = end, ymin = row - 0.35, ymax = row + 0.35, fill = strand)) +
  geom_text(data = function(d) d[is.na(d$parent), ],
    aes(x = (start + end) / 2, y = row + 0.5, label = name),
    size = 2.5, na.rm = TRUE, check_overlap = TRUE) +
  scale_fill_manual(values = ${strandColors}, guide = "none") +
  scale_color_manual(values = ${strandColors}, guide = "none") +
  scale_y_reverse() +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`,
  }
}

/** Read the feature track's source uri into an R gene-model panel. GFF vs BED
 * is decided by which adapter location is set (the `uri` shorthand falls back to
 * a filename check) so a BED track is parsed as BED, not misread as GFF. */
export function exportRCode(self: LinearBasicDisplayModel): RTrackFragment {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  const gffUri = firstUri(adapter.gffGzLocation?.uri, adapter.gffLocation?.uri)
  const bedUri = firstUri(adapter.bedGzLocation?.uri, adapter.bedLocation?.uri)
  const shorthand = adapter.uri ?? ''
  const isBed =
    bedUri !== '' || (gffUri === '' && /\.bed(\.gz)?$/i.test(shorthand))
  return geneFragment({
    trackId,
    trackName,
    uri: firstUri(gffUri, bedUri, shorthand),
    format: isBed ? 'bed' : 'gff',
  })
}
