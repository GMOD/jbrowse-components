import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearWebGLFeatureDisplayModel } from './model.ts'

function safeVarName(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

export function exportRCode(
  self: LinearWebGLFeatureDisplayModel,
  _opts: Record<string, unknown>,
) {
  const track = getContainingTrack(self)
  const trackId = track.configuration.trackId as string
  const trackName = (getConf(track, 'name') as string) || trackId
  const adapterConf = getConf(track, 'adapter')
  const adapterType = adapterConf?.type as string

  const safeId = safeVarName(trackId)
  const dataVar = `features_${safeId}`
  const plotVar = `p_${safeId}`

  const isVcf =
    adapterType === 'VcfTabixAdapter' || adapterType === 'VcfAdapter'

  const dataCode = isVcf
    ? `# Columns: ref_name, start, end, feature_id, name, ref, alt, qual, filter, type
${dataVar} <- jb_features(session, "${trackId}", region)`
    : `# Columns: ref_name, start, end, strand, type, feature_id, name, parent_id
${dataVar} <- jb_features(session, "${trackId}", region)`

  let plotCode: string

  if (isVcf) {
    plotCode = `${plotVar} <- ggplot(${dataVar}, aes(x = start, color = type, label = name)) +
  geom_variant(style = "lollipop") +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}") +
  theme_jbrowse_track()`
  } else {
    const isGeneTrack =
      adapterType?.includes('Gff3') ||
      trackName.toLowerCase().includes('gene') ||
      trackName.toLowerCase().includes('transcript')

    if (isGeneTrack) {
      plotCode = `# prepare_gene_data() splits features into top-level genes (with layout_row)
# and subfeatures (exons, CDS, UTRs linked to parent layout_row)
${dataVar}_prepared <- prepare_gene_data(${dataVar})

${plotVar} <- ggplot() +
  geom_transcript(
    data = ${dataVar}_prepared$genes,
    subfeatures = ${dataVar}_prepared$subfeatures,
    aes(xmin = start, xmax = end, y = layout_row)
  ) +
  geom_text(
    data = ${dataVar}_prepared$genes |> dplyr::filter(!is.na(name)),
    aes(x = start, y = layout_row + 0.5, label = name),
    hjust = 0, size = 2.5
  ) +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}") +
  theme_jbrowse_track() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`
    } else {
      plotCode = `${dataVar}_layout <- compute_layout(${dataVar}, padding = 200)

${plotVar} <- ggplot(${dataVar}_layout) +
  geom_gene(aes(xmin = start, xmax = end, y = layout_row)) +
  scale_x_genomic(region = region) +
  labs(title = "${trackName}") +
  theme_jbrowse_track() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`
    }
  }

  return {
    trackId,
    trackName,
    displayType: 'LinearWebGLFeatureDisplay',
    packages: ['ggjbrowse', 'ggplot2', 'dplyr'],
    dataCode,
    plotCode,
    dataVariable: dataVar,
    plotVariable: plotVar,
  }
}
