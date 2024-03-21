import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import stateModelFactory from './model'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addConnectionType(
    () =>
      new ConnectionType({
        configSchema,
        description: 'A track or assembly hub in the Track Hub format',
        displayName: 'UCSC Track Hub',
        name: 'UCSCTrackHubConnection',
        stateModel: stateModelFactory(pluginManager),
        url: '//genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro',
      }),
  )
}
