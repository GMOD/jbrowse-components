import { retiredSettings } from '@jbrowse/display-kit/retiredSettings'

import type PluginManager from '@jbrowse/core/PluginManager'

export const {
  refuseRetiredConfig,
  refuseRetiredState,
  routeRetiredShorthand,
  routeTrackShorthand,
} = retiredSettings({
  displayType: 'LinearMultiRowFeatureDisplay',
  trackType: 'FeatureTrack',
  config: {
    partitionField: '`rows` (`rows: "sample"`, or `rows: { field, domain }`)',
    domain: '`rows.domain`',
    sampleColorMap: '`rowColor: { domain: [...rows], range: [...colors] }`',
    colorDomain: '`color.domain`',
    legend:
      '`color: { scale: "identity", domain: [...colors], labels: [...names] }`',
  },
  state: ['layout', 'clusterTree', 'clusterProvenance', 'subtreeFilter'],
})

export function routeRetiredShorthandF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-preProcessTrackConfig',
    routeTrackShorthand,
  )
}
