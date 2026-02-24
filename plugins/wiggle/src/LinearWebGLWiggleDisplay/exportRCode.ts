import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearWebGLWiggleDisplayModel } from './model.ts'

function safeVarName(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

export function exportRCode(
  self: LinearWebGLWiggleDisplayModel,
  opts: Record<string, unknown>,
) {
  const track = getContainingTrack(self)
  const trackId = track.configuration.trackId as string
  const trackName = (getConf(track, 'name') as string) || trackId
  const safeId = safeVarName(trackId)
  const dataVar = `coverage_${safeId}`
  const plotVar = `p_${safeId}`

  const color = self.color || (getConf(self, 'color') as string) || 'steelblue'
  const filled = self.fill ?? (getConf(self, 'filled') as boolean) ?? true
  const rendererType = self.rendererTypeName
  const isLinePlot = rendererType === 'LinePlotRenderer'
  const isDensity = rendererType === 'DensityRenderer'

  const dataCode = `# Columns: ref_name, start, end, score
${dataVar} <- jb_features(session, "${trackId}", region)`

  let geomCode: string
  if (isDensity) {
    geomCode = `geom_tile(aes(x = (start + end) / 2, y = 0, fill = score, width = end - start)) +
  scale_fill_viridis_c()`
  } else if (isLinePlot || !filled) {
    geomCode = `geom_wiggle(fill = NA, color = "${color}", linewidth = 0.5)`
  } else {
    geomCode = `geom_wiggle(fill = "${color}", alpha = 0.8)`
  }

  const plotCode = `${plotVar} <- ggplot(${dataVar}, aes(x = start, xend = end, y = score)) +
  ${geomCode} +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}", y = "Score") +
  theme_jbrowse_track()`

  return {
    trackId,
    trackName,
    displayType: 'LinearWiggleDisplay',
    packages: ['ggjbrowse', 'ggplot2'],
    dataCode,
    plotCode,
    dataVariable: dataVar,
    plotVariable: plotVar,
  }
}
