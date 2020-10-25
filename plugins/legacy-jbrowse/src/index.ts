import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as NCListAdapterClass,
  configSchema as ncListAdapterConfigSchema,
} from './NCListAdapter'
import {
  configSchema as jbrowse1ConfigSchema,
  modelFactory as jbrowse1ModelFactory,
} from './JBrowse1Connection'

export default class LegacyJBrowsePlugin extends Plugin {
  name = 'LegacyJBrowsePlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'NCListAdapter',
          configSchema: ncListAdapterConfigSchema,
          AdapterClass: NCListAdapterClass,
        }),
    )

    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'JBrowse1Connection',
          configSchema: jbrowse1ConfigSchema,
          stateModel: jbrowse1ModelFactory(pluginManager),
          displayName: 'JBrowse 1 Data',
          description: 'A JBrowse 1 data directory',
          url: '//jbrowse.org/',
        }),
    )
  }
}
