import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'

// locals
import AdapterClass from './JBrowse1TextSearchAdapter'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addTextSearchAdapterType(
    () =>
      new TextSearchAdapterType({
        AdapterClass,
        configSchema,
        description: 'A JBrowse 1 text search adapter',
        name: 'JBrowse1TextSearchAdapter',
      }),
  )
}
