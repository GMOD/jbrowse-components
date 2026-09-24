import { retiredSettings } from '@jbrowse/display-kit/retiredSettings'

import type PluginManager from '@jbrowse/core/PluginManager'

export const {
  refuseRetiredConfig,
  refuseRetiredState,
  routeRetiredShorthand,
  routeTrackShorthand,
} = retiredSettings({
  displayType: 'LinearMafDisplay',
  trackType: 'MafTrack',
  config: {
    domain:
      '`rows.domain` (`rows: { domain: [...] }`), the row order beside the labels, tree and focus',
  },
  state: ['layout', 'clusterTree', 'clusterProvenance', 'subtreeFilter'],
})

export function routeRetiredShorthandF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-preProcessTrackConfig',
    routeTrackShorthand,
  )
}
