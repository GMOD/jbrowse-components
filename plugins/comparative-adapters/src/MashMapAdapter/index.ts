import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import AdapterClass from './MashMapAdapter'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MashMapAdapter',
        configSchema,
        adapterMetadata: {
          category: null,
          hiddenFromGUI: true,
          displayName: null,
          description: null,
        },
        AdapterClass,
      }),
  )
}
