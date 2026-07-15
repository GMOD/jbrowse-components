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
 *
 * #example
 * The same track with appearance settings in place. Rather than writing out the
 * full `displays` array, you can list them in a `displayDefaults` object —
 * JBrowse works out which display they belong to and applies them for you (here,
 * the `LinearWiggleDisplay`), so you don't have to know display names:
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
 *   displayDefaults: { scaleType: 'log', color: 'darkgreen', useBicolor: false },
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
