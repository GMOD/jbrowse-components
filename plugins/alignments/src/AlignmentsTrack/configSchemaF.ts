import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config AlignmentsTrack
 * has very little config; most config and state logic is on the display
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'AlignmentsTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}
