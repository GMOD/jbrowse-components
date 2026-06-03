import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config QuantitativeTrack
 * a numerical signal track (coverage, conservation, etc.), typically backed by
 * a BigWig file and drawn as an XY plot or density
 *
 * #example
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BigWigAdapter',
 *     uri: 'https://example.com/coverage.bw',
 *   },
 * }
 * ```
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
