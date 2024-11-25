import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MultiQuantitativeTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'MultiQuantitativeTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}

export default configSchema
