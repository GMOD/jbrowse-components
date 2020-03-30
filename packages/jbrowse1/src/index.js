import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  AdapterClass as NCListAdapterClass,
  configSchema as ncListAdapterConfigSchema,
} from './NCListAdapter'
//@ts-ignore
import {
  configSchema as jbrowse1ConfigSchema,
  modelFactory as jbrowse1ModelFactory,
} from './JBrowse1Connection'

export default class extends Plugin {
  install(pluginManager) {
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
