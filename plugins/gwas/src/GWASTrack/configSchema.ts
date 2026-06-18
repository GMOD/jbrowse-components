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
 * `neg_log_pvalue`. Override it if your BED has the p-value (not -log10 p) in a
 * different column:
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
