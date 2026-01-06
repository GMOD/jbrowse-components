import Plugin from '@jbrowse/core/Plugin'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'

import configSchema from './TrixTextSearchAdapter/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

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
          import('./TrixTextSearchAdapter/TrixTextSearchAdapter.ts').then(
            d => d.default,
          ),
      })
    })
  }
}
