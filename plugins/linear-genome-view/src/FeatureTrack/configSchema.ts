import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config FeatureTrack
 * #category track
 * used for basic gene and feature tracks, generally used with LinearBasicDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'FeatureTrack',
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

export default configSchema
