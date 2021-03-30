import AdapterType from '../pluggableElementTypes/TextSearchAdapterType'
import PluginManager from '../PluginManager'
import Plugin from '../Plugin'
import {
  AdapterClass as Jbrowse1TextSearchAdapterClass,
  configSchema as jbrowse1TextSearchAdapterConfigSchema,
} from './JbrowseTextSeachAdapter'

export default class extends Plugin {
  name = 'Jbrowse1TextSearchPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'JBrowse1TextSearchAdapter',
          configSchema: jbrowse1TextSearchAdapterConfigSchema,
          AdapterClass: Jbrowse1TextSearchAdapterClass,
        }),
    )
  }
}
