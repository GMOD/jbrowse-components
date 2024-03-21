import PluginManager from '@jbrowse/core/PluginManager'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'

// locals
import modelFactory from './model'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addConnectionType(
    () =>
      new ConnectionType({
        configSchema,
        description: 'A JBrowse 1 data directory',
        displayName: 'JBrowse 1 Data',
        name: 'JBrowse1Connection',
        stateModel: modelFactory(pluginManager),
        url: '//jbrowse.org/',
      }),
  )
}
