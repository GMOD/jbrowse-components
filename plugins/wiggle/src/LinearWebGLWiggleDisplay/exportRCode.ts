import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'

import type { WiggleDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface ExportRCodeOptions {
  useJbrowseR?: boolean
  embedData?: boolean
  region?: {
    refName: string
    start: number
    end: number
  }
}

interface RCodeFragment {
  trackId: string
  trackName: string
  displayType: string
  packages: string[]
  dataCode: string
  plotCode: string
  dataVariable: string
  plotVariable: string
  setupCode?: string
}

/**
 * Generate a safe R variable name
 */
function safeVarName(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

/**
 * Export R code for LinearWiggleDisplay
 */
export function exportRCode(
  self: WiggleDisplayModel,
  opts: ExportRCodeOptions,
): RCodeFragment {
  const track = getContainingTrack(self)
  const view = getContainingView(self) as LinearGenomeViewModel
  const trackId = track.configuration.trackId as string
  const trackName = (getConf(track, 'name') as string) || trackId
  const adapterConf = getConf(track, 'adapter')
  const adapterType = adapterConf?.type as string

  const region = opts.region || view.displayedRegions[0]
  const safeId = safeVarName(trackId)
  const dataVar = `coverage_${safeId}`
  const plotVar = `p_${safeId}`

  // Get display settings
  const color = self.color || (getConf(self, 'color') as string) || 'steelblue'
  const posColor =
    self.posColor || (getConf(self, 'posColor') as string) || 'blue'
  const negColor =
    self.negColor || (getConf(self, 'negColor') as string) || 'red'
  const filled = self.fill ?? (getConf(self, 'filled') as boolean) ?? true
  const height = self.height

  // Determine renderer type for plot style
  const rendererType = self.rendererTypeName
  const isLinePlot = rendererType === 'LinePlotRenderer'
  const isDensity = rendererType === 'DensityRenderer'

  let packages: string[]
  let dataCode: string

  if (opts.useJbrowseR) {
    packages = ['jbrowseR', 'ggjbrowse', 'ggplot2']
    dataCode = `# Load coverage data using jbrowseR
${dataVar} <- jb_features(session, "${trackId}", region)`
  } else {
    packages = ['rtracklayer', 'ggjbrowse', 'ggplot2', 'tibble', 'dplyr']

    if (adapterType === 'BigWigAdapter') {
      const uri = adapterConf.bigWigLocation?.uri || '[BigWig URL]'
      dataCode = `# Load BigWig data using rtracklayer
${dataVar}_gr <- rtracklayer::import(
  "${uri}",
  which = GenomicRanges::GRanges("${region?.refName}:${(region?.start || 0) + 1}-${region?.end}")
)
${dataVar} <- tibble::as_tibble(${dataVar}_gr) |>
  dplyr::select(seqnames, start, end, score) |>
  dplyr::rename(ref_name = seqnames) |>
  dplyr::mutate(start = start - 1)  # Convert to 0-based`
    } else {
      dataCode = `# Load quantitative data
# Adapter type: ${adapterType}
# You may need to adjust this based on your data source
${dataVar} <- tibble::tibble(
  ref_name = character(),
  start = integer(),
  end = integer(),
  score = numeric()
)`
    }
  }

  // Generate plot code based on renderer type
  let geomCode: string
  if (isDensity) {
    geomCode = `geom_tile(aes(x = (start + end) / 2, y = 0, fill = score, width = end - start)) +
  scale_fill_viridis_c()`
  } else if (isLinePlot || !filled) {
    geomCode = `geom_wiggle(fill = NA, color = "${color}", linewidth = 0.5)`
  } else {
    geomCode = `geom_wiggle(fill = "${color}", alpha = 0.8)`
  }

  const plotCode = `# Coverage track: ${trackName}
${plotVar} <- ggplot(${dataVar}, aes(x = start, xend = end, y = score)) +
  ${geomCode} +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}", y = "Score") +
  theme_jbrowse_track() +
  theme(plot.margin = margin(5, 5, 5, 5))`

  return {
    trackId,
    trackName,
    displayType: 'LinearWiggleDisplay',
    packages,
    dataCode,
    plotCode,
    dataVariable: dataVar,
    plotVariable: plotVar,
  }
}
