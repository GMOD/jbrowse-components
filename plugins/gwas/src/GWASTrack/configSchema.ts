import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GWASTrack
 * #category track
 * used for GWAS (Genome-Wide Association Study) tracks with Manhattan plot display
 *
 * #example
 * `GWASAdapter` is a `BedTabixAdapter` that defaults `scoreColumn` to
 * `neg_log_pvalue`. If your BED holds a raw p-value (not -log10 p), point
 * `scoreColumn` at that column *and* set `scoreTransform: 'negLog10'` so it's
 * converted into the Manhattan -log10 p value (use `negLog10FromLn` for a
 * natural-log p-value):
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
