import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearVariantDisplayModel } from './model.ts'
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

export interface VariantRParams {
  trackId: string
  trackName: string
  uri: string
}

/**
 * Pure builder for the R panel of a variant (VCF) track. Reads the tabix'd VCF
 * over the region with the inline `read_vcf()` helper (Rsamtools scanTabix, no
 * VariantAnnotation dependency), classifies each record (SNV / INS / DEL / MNV /
 * SV type), row-packs overlaps with `vcf_layout()`, and draws each variant as a
 * colored span (`geom_segment`) with a lollipop head (`geom_point`) so both
 * point variants and spanning SVs read clearly. Pure ggplot2 + inline helpers,
 * no bespoke package. Reads `chrom`, `start`, `end` from the enclosing
 * plot_region() so it redraws for any locus.
 */
export function variantFragment(p: VariantRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['Rsamtools', 'GenomicRanges', 'ggplot2'],
    helpers: ['read_vcf', 'vcf_layout', 'bp_axis'],
    setup: `${pathVar} <- ${rStr(p.uri)}`,
    plotVariable: `p_${pathVar}`,
    heightWeight: 2,
    plotExpr: `ggplot(vcf_layout(read_vcf(${pathVar}, chrom, start, end))) +
  geom_segment(aes(x = start, xend = end, y = row, yend = row, color = type), linewidth = 1.1, na.rm = TRUE) +
  geom_point(aes(x = (start + end) / 2, y = row, color = type), size = 1.6, na.rm = TRUE) +
  scale_y_reverse() +
  coord_cartesian(xlim = c(start, end)) +
  bp_axis() +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL, color = "Type") +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`,
  }
}

/** Read the variant display's source uri into an R fragment. */
export function exportRCode(self: LinearVariantDisplayModel): RTrackFragment {
  const track = getContainingTrack(self)
  const trackId: string = track.configuration.trackId
  const adapter: AdapterConf = getConf(track, 'adapter')
  return variantFragment({
    trackId,
    trackName: getConf(track, 'name') || trackId,
    uri: adapter.vcfGzLocation?.uri ?? adapter.uri ?? '',
  })
}
