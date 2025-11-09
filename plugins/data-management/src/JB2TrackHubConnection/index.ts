import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'
import stateModelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function JB2TrackHubConnectionF(pluginManager: PluginManager) {
  pluginManager.addConnectionType(() => {
    return new ConnectionType({
      name: 'JB2TrackHubConnection',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      displayName: 'JB2 Track Hub',
      description: 'A JBrowse 2 config file based trackhub',
      url: 'https://jbrowse.org/jb2/',
    })
  })
}
