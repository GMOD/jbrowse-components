import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'

// locals
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function JBrowse1TextSearchAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addTextSearchAdapterType(
    () =>
      new TextSearchAdapterType({
        name: 'JBrowse1TextSearchAdapter',
        configSchema,
        description: 'A JBrowse 1 text search adapter',
        getAdapterClass: () =>
          import('./JBrowse1TextSearchAdapter').then(t => t.default),
      }),
  )
}
