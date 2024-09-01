// configs
import config from '../../public/test_data/volvox/config.json'

export function addRelativeUris(config: any, baseUri: string) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativeUris(config[key], baseUri)
      } else if (key === 'uri' && !config.baseUri) {
        config.baseUri = baseUri
      }
    }
  }
}

export function getVolvoxConfig() {
  const configPath = 'test_data/volvox/config.json'
  addRelativeUris(config, new URL(configPath, window.location.href).href)
  const supported = new Set([
    'AlignmentsTrack',
    'FeatureTrack',
    'VariantTrack',
    'WiggleTrack',
  ])

  const excludeIds = new Set([
    'gtf_plain_text_test',
    'lollipop_track',
    'arc_track',
  ])

  return {
    assembly: config.assemblies[0],
    tracks: config.tracks.filter(
      t => supported.has(t.type) && !excludeIds.has(t.trackId),
    ),
  }
}
