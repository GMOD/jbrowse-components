import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'

// locals
import configSchema from './configSchema'
import modelFactory from './model'
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
      }),
  )
}
