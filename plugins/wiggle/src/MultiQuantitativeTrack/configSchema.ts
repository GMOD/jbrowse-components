import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MultiQuantitativeTrack
 *
 * #example
 * Overlays several bigwig files as one track. `bigWigs` is the shorthand form
 * of `MultiWiggleAdapter` — equivalent to a `subadapters` array of individual
 * `BigWigAdapter` configs, one per source/sample:
 * ```js
 * {
 *   type: 'MultiQuantitativeTrack',
 *   trackId: 'coverage_by_sample',
 *   name: 'Coverage by sample',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'MultiWiggleAdapter',
 *     bigWigs: [
 *       'https://example.com/sample1.bw',
 *       'https://example.com/sample2.bw',
 *     ],
 *   },
 * }
 * ```
 */

const configSchema = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'MultiQuantitativeTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}

export default configSchema
