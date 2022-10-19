import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * !config VariantTrack
 */
const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'VariantTrack',
    {},
    {
      /**
       * !baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
