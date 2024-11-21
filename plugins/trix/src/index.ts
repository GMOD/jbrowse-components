import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './TrixTextSearchAdapter/configSchema'

export default class TrixPlugin extends Plugin {
  name = 'TrixPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTextSearchAdapterType(() => {
      return new TextSearchAdapterType({
        name: 'TrixTextSearchAdapter',
        displayName: 'Trix text search adapter',
        configSchema,
        description: 'Trix text search adapter',
        getAdapterClass: () =>
          import('./TrixTextSearchAdapter/TrixTextSearchAdapter').then(
            d => d.default,
          ),
      })
    })
  }
}
