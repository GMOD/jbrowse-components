import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import stateModelFactory from './model'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
