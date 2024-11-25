import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function UCSCTrackHubConnectionF(pluginManager: PluginManager) {
  pluginManager.addConnectionType(
    () =>
      new ConnectionType({
        name: 'UCSCTrackHubConnection',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        displayName: 'UCSC Track Hub',
        description: 'A track or assembly hub in the Track Hub format',
        url: '//genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro',
      }),
  )
}
