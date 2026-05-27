import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GCContentAdapter
 * #category adapter
 */

const GCContentAdapterF = (_pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'GCContentAdapter',
    {
      /**
       * #slot
       */
      sequenceAdapter: {
        type: 'frozen',
        defaultValue: null,
      },
      /**
       * #slot
       */
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       */
      windowDelta: {
        type: 'number',
        defaultValue: 100,
      },
    },
    { explicitlyTyped: true },
  )
}

export default GCContentAdapterF
