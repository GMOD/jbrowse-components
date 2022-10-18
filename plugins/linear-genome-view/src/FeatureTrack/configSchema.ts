import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * !config FeatureTrack
 */
const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'FeatureTrack',
    {},
    {
      /**
       * !baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
      explicitIdentifier: 'trackId',
    },
  )

export default configSchema
