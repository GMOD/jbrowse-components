import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'
import { fetchUCSCTrackHubTracks } from './fetchTracks.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function UCSCTrackHubConnectionF(pluginManager: PluginManager) {
  pluginManager.addConnectionType(() => {
    return new ConnectionType({
      name: 'UCSCTrackHubConnection',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      displayName: 'UCSC Track Hub',
      description: 'A track or assembly hub in the Track Hub format',
      url: 'https://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro',
      fetchTracks: fetchUCSCTrackHubTracks,
    })
  })
}
