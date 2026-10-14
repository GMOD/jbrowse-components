import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GWASTrack
 * #category track
 * Holds Genome-Wide Association Study (GWAS) results, drawn as a Manhattan
 * plot.
 *
 * #example
 * A BED of raw p-values: `scoreTransform: 'negLog10'` turns each into
 * -log10(p) at load. `GWASAdapter` lists the other transforms:
 * ```js
 * {
 *   type: 'GWASTrack',
 *   trackId: 'gwas',
 *   name: 'GWAS results',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GWASAdapter',
 *     uri: 'https://example.com/gwas.bed.gz',
 *     scoreColumn: 'p_value',
 *     scoreTransform: 'negLog10',
 *   },
 * }
 * ```
 */
export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'GWASTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}
