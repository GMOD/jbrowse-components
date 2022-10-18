import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * !config QuantitativeTrack
 */
const configSchema = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'QuantitativeTrack',
    {},
    {
      /**
       * !baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}

export default configSchema
