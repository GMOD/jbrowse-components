import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearHicDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  hicLocation?: { uri?: string }
  uri?: string
}

function safeVarName(str: string) {
  return str.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

function rStr(s: string) {
  return `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
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
 * the region with the inline `read_hic()` helper (`strawr::straw`, the reader
 * from the .hic authors), mirrors straw's upper triangle across the diagonal,
 * and draws a square `geom_raster` heatmap with `coord_fixed()`. `binsize` and
 * `norm` are emitted as visible script variables the user can edit. Pure
 * ggplot2 + inline helper, no bespoke package. Reads `chrom`, `start`, `end`
 * from the enclosing plot_region() so it redraws for any locus.
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
    helpers: ['read_hic', 'bp_axis'],
    setup: `${pathVar} <- ${rStr(p.uri)}
${binsizeVar} <- ${p.binsize} # bin size in bp; use strawr::readHicBpResolutions(${pathVar}) for options
${normVar} <- ${rStr(p.norm)} # normalization; use strawr::readHicNormTypes(${pathVar}) for options`,
    plotVariable: `p_${pathVar}`,
    // a square contact map wants generous vertical space (coord_fixed letterboxes
    // it within the panel), so weight it well above a 1-D track
    heightWeight: 5,
    plotExpr: `ggplot(read_hic(${pathVar}, chrom, start, end, ${binsizeVar}, ${normVar})) +
  geom_raster(aes(x = x, y = y, fill = counts)) +
  scale_fill_viridis_c(trans = ${rStr(trans)}, name = "Contacts", na.value = "white") +
  bp_axis() +
  scale_y_continuous(labels = scales::label_number(scale_cut = scales::cut_si("b")), expand = expansion(mult = 0.01)) +
  coord_fixed(xlim = c(start, end), ylim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
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
  const track = getContainingTrack(self)
  const trackId: string = track.configuration.trackId
  const adapter: AdapterConf = getConf(track, 'adapter')
  const uri = adapter.hicLocation?.uri ?? adapter.uri
  return uri
    ? hicFragment({
        trackId,
        trackName: getConf(track, 'name') || trackId,
        uri,
        binsize,
        norm: self.activeNormalization,
        useLogScale: self.useLogScale,
      })
    : undefined
}
