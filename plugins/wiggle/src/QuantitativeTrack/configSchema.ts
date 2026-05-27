import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config QuantitativeTrack
 */

function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'QuantitativeTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}

export default configSchemaFactory
