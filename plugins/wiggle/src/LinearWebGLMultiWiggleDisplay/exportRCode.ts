import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearWebGLMultiWiggleDisplayModel } from './model.ts'

function safeVarName(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

const defaultColors = [
  '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#264653',
  '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#606C38',
]

export function exportRCode(
  self: LinearWebGLMultiWiggleDisplayModel,
  _opts: Record<string, unknown>,
) {
  const track = getContainingTrack(self)
  const trackId = track.configuration.trackId as string
  const trackName = (getConf(track, 'name') as string) || trackId

  const safeId = safeVarName(trackId)
  const dataVar = `multi_${safeId}`
  const plotVar = `p_${safeId}`

  const sources = self.sources || []

  const dataCode = `# Columns: ref_name, start, end, score, source
${dataVar} <- jb_features(session, "${trackId}", region)`

  const colorMapping = sources
    .map(
      (s, i) =>
        `"${s.name}" = "${s.color || defaultColors[i % defaultColors.length]}"`,
    )
    .join(', ')

  const plotCode = `${plotVar} <- ggplot(${dataVar}, aes(x = start, xend = end, y = score, fill = source, color = source)) +
  geom_wiggle(alpha = 0.6) +${
    colorMapping
      ? `\n  scale_fill_manual(values = c(${colorMapping})) +\n  scale_color_manual(values = c(${colorMapping})) +`
      : ''
  }
  scale_x_genomic(region = region) +
  labs(title = "${trackName}", y = "Score") +
  theme_jbrowse_track() +
  theme(legend.position = "right")`

  return {
    trackId,
    trackName,
    displayType: 'LinearWebGLMultiWiggleDisplay',
    packages: ['ggjbrowse', 'ggplot2'],
    dataCode,
    plotCode,
    dataVariable: dataVar,
    plotVariable: plotVar,
  }
}
