import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GCContentAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GCContentAdapterF = (pluginManager: PluginManager) => {
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
    },
    { explicitlyTyped: true },
  )
}

export default GCContentAdapterF
