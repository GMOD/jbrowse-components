import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import type { LinearHicDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  hicLocation?: { uri?: string }
  uri?: string
}

export interface HicRParams {
  trackId: string
  trackName: string
  uri: string
  // resolution (bin size in bp) the .hic file offers; emitted as a visible,
  // editable script variable that defaults to JBrowse's current auto-pick
  binsize: number
  // normalization the file offers (NONE/KR/VC/...), matching what JBrowse shows
  norm: string
  // log-scale the contact counts like the display's useLogScale
  useLogScale: boolean
}

/**
 * Pure builder for the R panel of a Hi-C track. Reads the contact matrix over
 * the region with the inline `hic_triangle()` helper (`strawr::straw`, the
 * reader from the .hic authors), rotates straw's upper triangle 45 degrees into
 * diamond polygons, and draws it as `geom_polygon` over a genomic x-axis — the
 * same triangular Hi-C view JBrowse shows, so the map shares its x-range with
 * the other stacked tracks (e.g. a gene track). `binsize` and `norm` are emitted
 * as visible script variables the user can edit. Pure ggplot2 + inline helper,
 * no bespoke package. Reads `chrom`, `start`, `end` from the enclosing
 * plot_region() so it redraws for any locus.
 */
export function hicFragment(p: HicRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const binsizeVar = `${pathVar}_binsize`
  const normVar = `${pathVar}_norm`
  // log-scale suits Hi-C contact counts (long-tailed); honor the display setting
  const trans = p.useLogScale ? 'log1p' : 'identity'
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['strawr', 'ggplot2'],
    helpers: ['hic_triangle', 'bp_axis'],
    setup: `${pathVar} <- ${rStr(p.uri)}
${binsizeVar} <- ${p.binsize} # bin size in bp; use strawr::readHicBpResolutions(${pathVar}) for options
${normVar} <- ${rStr(p.norm)} # normalization; use strawr::readHicNormTypes(${pathVar}) for options`,
    plotVariable: `p_${pathVar}`,
    // the rotated triangle rises to (region width)/2 at its apex; give it a few
    // track-heights of vertical room (the y-axis is interaction distance)
    heightWeight: 3,
    plotExpr: `ggplot(hic_triangle(${pathVar}, chrom, start, end, ${binsizeVar}, ${normVar})) +
  geom_polygon(aes(x = gx, y = gy, fill = counts, group = group)) +
  scale_fill_viridis_c(trans = ${rStr(trans)}, name = "Contacts", na.value = "white") +
  bp_axis() +
  scale_y_continuous(labels = scales::label_number(scale_cut = scales::cut_si("b")), expand = expansion(mult = c(0, 0.02))) +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = "Distance") +
  theme_minimal()`,
  }
}

/** Read the Hi-C display's source uri + resolution/normalization into a fragment. */
export function exportRCode(
  self: LinearHicDisplayModel,
): RTrackFragment | undefined {
  const binsize = self.effectiveResolution
  // binsize is unknown until the .hic metadata (resolutions) has loaded; skip
  // the track rather than emit a script that can't pick a resolution
  if (binsize === undefined) {
    return undefined
  }
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  const uri = firstUri(adapter.hicLocation?.uri, adapter.uri)
  return uri
    ? hicFragment({
        trackId,
        trackName,
        uri,
        binsize,
        norm: self.activeNormalization,
        useLogScale: self.useLogScale,
      })
    : undefined
}
