import {
  generateUnsupportedTrackConf,
  guessAdapter,
  guessTrackType,
  UNSUPPORTED,
} from '@gmod/jbrowse-core/util/tracks'

export function convertTrackConfig(
  jb1TrackConfig: Track,
  dataRoot: string,
): Record<string, any> {
  const jb2TrackConfig = {}

  jb2TrackConfig.configId = jb1TrackConfig.label
  jb2TrackConfig.name = jb1TrackConfig.key || jb1TrackConfig.label

  const description =
    jb1TrackConfig.metadata &&
    (jb1TrackConfig.metadata.description || jb1TrackConfig.metadata.Description)
  if (description) jb2TrackConfig.description = description

  const category =
    jb1TrackConfig.category ||
    (jb1TrackConfig.metadata && jb1TrackConfig.metadata.category)
  jb2TrackConfig.category = category ? category.split(/\s*\/\s*/) : []

  if (!jb1TrackConfig.urlTemplate) {
    if (
      !(
        jb1TrackConfig.storeClass &&
        jb1TrackConfig.storeClass.endsWith('FromConfig')
      )
    )
      throw new Error(
        `JBrowse1 track "${jb1TrackConfig.key ||
          jb1TrackConfig.label}" must have a "urlTemplate" or be a "FromConfig" track`,
      )
    return generateFromConfigTrackConfig(jb1TrackConfig, jb2TrackConfig)
  }

  const urlTemplate = new URL(jb1TrackConfig.urlTemplate, `${dataRoot}/`).href
    .replace(/%7B/gi, '{')
    .replace(/%7D/gi, '}')
  jb2TrackConfig.adapter = guessAdapter(urlTemplate, 'uri')

  if (jb2TrackConfig.adapter.type === UNSUPPORTED)
    return generateUnsupportedTrackConf(
      jb2TrackConfig.name,
      urlTemplate,
      jb2TrackConfig.category,
    )

  jb2TrackConfig.type = guessTrackType(jb2TrackConfig.adapter.type)

  if (jb2TrackConfig.type === 'WiggleTrack') {
    if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('XYPlot'))
      jb2TrackConfig.defaultRendering = 'xyplot'
    else if (jb1TrackConfig.type && jb1TrackConfig.type.endsWith('Density'))
      jb2TrackConfig.defaultRendering = 'density'
  }

  return jb2TrackConfig
}

function generateFromConfigTrackConfig(
  jb1TrackConfig: Track,
  jb2TrackConfig: Record<string, any>,
): Record<string, any> {
  const jb1Features = jb1TrackConfig.features || []
  const jb2Features = jb1Features.map(
    (feature): Record<string, any> => {
      const jb2Feature: Record<string, any> = JSON.parse(
        JSON.stringify(feature),
      )
      jb2Feature.refName = feature.seq_id
      jb2Feature.uniqueId = `${feature.seq_id}:${feature.start}-${
        feature.end
      }:${feature.name || ''}`
      return jb2Feature
    },
  )
  jb2TrackConfig.adapter = {
    type: 'FromConfigAdapter',
    features: jb2Features,
  }
  jb2TrackConfig.type = 'BasicTrack'
  jb2TrackConfig.renderer = { type: 'SvgFeatureRenderer' }
  return jb2TrackConfig
}
