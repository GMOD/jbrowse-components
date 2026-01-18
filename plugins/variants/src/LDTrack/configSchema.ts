import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LDTrack
 * Track type for displaying pre-computed linkage disequilibrium data
 * (e.g., from PLINK --r2 output)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'LDTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
