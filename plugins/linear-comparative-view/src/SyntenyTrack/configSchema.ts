import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config SyntenyTrack
 * extends
 * - [BaseTrack](../basetrack)
 */

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'SyntenyTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
