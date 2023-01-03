import PluginManager from '@jbrowse/core/PluginManager'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'

// locals
import modelFactory from './model'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
