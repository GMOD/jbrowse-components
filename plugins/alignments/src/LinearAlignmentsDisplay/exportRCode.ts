import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearAlignmentsDisplayModel } from './model.ts'

function safeVarName(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

export function exportRCode(
  self: LinearAlignmentsDisplayModel,
  _opts: Record<string, unknown>,
) {
  const track = getContainingTrack(self)
  const trackId = track.configuration.trackId as string
  const trackName = (getConf(track, 'name') as string) || trackId

  const safeId = safeVarName(trackId)
  const dataVar = `alignments_${safeId}`
  const plotVar = `p_${safeId}`

  const dataCode = `# Columns: ref_name, start, end, strand, name, flags, mapq, cigar
${dataVar} <- jb_features(session, "${trackId}", region)`

  const plotCode = `${dataVar}_pileup <- compute_pileup(${dataVar})

${plotVar} <- ggplot(${dataVar}_pileup, aes(xmin = start, xmax = end, y = pileup_row, fill = factor(strand))) +
  geom_alignment() +
  scale_fill_manual(
    values = c("-1" = "#f4a582", "1" = "#92c5de"),
    labels = c("-1" = "Reverse", "1" = "Forward"),
    name = "Strand"
  ) +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}") +
  theme_jbrowse_track() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`

  return {
    trackId,
    trackName,
    displayType: 'LinearAlignmentsDisplay',
    packages: ['ggjbrowse', 'ggplot2'],
    dataCode,
    plotCode,
    dataVariable: dataVar,
    plotVariable: plotVar,
  }
}
