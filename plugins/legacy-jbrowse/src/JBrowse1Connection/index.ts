import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'

import configSchema from './configSchema.ts'
import { fetchJBrowse1Tracks } from './fetchTracks.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function JBrowse1ConnectionF(pluginManager: PluginManager) {
  pluginManager.addConnectionType(
    () =>
      new ConnectionType({
        name: 'JBrowse1Connection',
        configSchema,
        stateModel: modelFactory(pluginManager),
        displayName: 'JBrowse 1 Data',
        description: 'A JBrowse 1 data directory',
        url: '//jbrowse.org/',
        fetchTracks: fetchJBrowse1Tracks,
      }),
  )
}
