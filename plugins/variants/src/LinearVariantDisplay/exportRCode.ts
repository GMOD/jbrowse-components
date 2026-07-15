import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import type { LinearVariantDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  vcfGzLocation?: { uri?: string }
  uri?: string
}

export interface VariantRParams {
  trackId: string
  trackName: string
  uri: string
}

/**
 * Pure builder for the R panel of a variant (VCF) track. Reads the tabix'd VCF
 * over the region with the inline `read_vcf()` helper (Rsamtools scanTabix, no
 * VariantAnnotation dependency) and row-packs overlaps with `vcf_layout()`. Each
 * variant draws as a plain box (`geom_rect`), like a feature/gene track, in one
 * flat color — no per-type coloring, no lollipop head. Point variants (SNVs) get
 * a viewport-relative minimum width so they stay visible when zoomed out. Pure
 * ggplot2 + inline helpers, no bespoke package. Reads `chrom`, `start`, `end`
 * from the enclosing plot_region() so it redraws for any locus.
 */
export function variantFragment(p: VariantRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const color = '#7570b3'
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['Rsamtools', 'GenomicRanges', 'ggplot2'],
    helpers: ['read_vcf', 'vcf_layout', 'bp_axis'],
    setup: `${pathVar} <- ${rStr(p.uri)}`,
    plotVariable: `p_${pathVar}`,
    heightWeight: 2,
    plotExpr: `ggplot(vcf_layout(read_vcf(${pathVar}, chrom, start, end))) +
  geom_rect(aes(xmin = start, xmax = pmax(end, start + (.env$end - .env$start) * 0.004),
    ymin = row - 0.3, ymax = row + 0.3), fill = ${rStr(color)}, na.rm = TRUE) +
  scale_y_reverse() +
  coord_cartesian(xlim = c(start, end)) +
  bp_axis() +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`,
  }
}

/** Read the variant display's source uri into an R fragment. */
export function exportRCode(self: LinearVariantDisplayModel): RTrackFragment {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  return variantFragment({
    trackId,
    trackName,
    uri: firstUri(adapter.vcfGzLocation?.uri, adapter.uri),
  })
}
