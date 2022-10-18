import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * !config BasicTrack
 * synonym for FeatureTrack
 */
const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'BasicTrack',
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
