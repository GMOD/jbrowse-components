import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config BasicTrack
 * #category track
 * synonym for FeatureTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'BasicTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
      explicitIdentifier: 'trackId',
    },
  )
export default configSchema
