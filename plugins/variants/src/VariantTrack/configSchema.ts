import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config VariantTrack
 * Mostly similar to feature track, but has `ChordDisplayType` registered to it,
 * and custom feature details in `LinearVariantDisplay`
 */
export default function VariantTrackF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'VariantTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}
