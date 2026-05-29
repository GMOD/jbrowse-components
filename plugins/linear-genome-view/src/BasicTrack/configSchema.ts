import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config BasicTrack
 * #category track
 *
 * Back-compat synonym for [FeatureTrack](../featuretrack): identical config,
 * kept so existing `type: 'BasicTrack'` configs (and third-party plugins that
 * reference the name) keep loading. New tracks should use FeatureTrack.
 */

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
