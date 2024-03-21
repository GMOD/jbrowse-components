import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GCContentAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GCContentAdapterF = (_pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'GCContentAdapter',
    {
      /**
       * #slot
       */
      sequenceAdapter: {
        defaultValue: null,
        type: 'frozen',
      },

      /**
       * #slot
       */
      windowDelta: {
        defaultValue: 100,
        type: 'number',
      },

      /**
       * #slot
       */
      windowSize: {
        defaultValue: 100,
        type: 'number',
      },
    },
    { explicitlyTyped: true },
  )
}

export default GCContentAdapterF
