import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'MafTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
      /**
       * #identifier
       */
      explicitIdentifier: 'trackId',
    },
  )
}
