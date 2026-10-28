import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config FeatureTrack
 * #category track
 * Holds gene and other feature annotations, such as a GFF3 or BED file, which
 * `LinearBasicDisplay` usually draws.
 *
 * #example
 * A minimal track. `adapter` points at the data file:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes',
 *   name: 'Genes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/genes.sorted.gff.gz',
 *   },
 * }
 * ```
 *
 * #example
 * The same track, colored per feature. `displayDefaults` applies settings to
 * whichever display takes them, here `LinearBasicDisplay`:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes',
 *   name: 'Genes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/genes.sorted.gff.gz',
 *   },
 *   displayDefaults: {
 *     encoding: { color: { value: "jexl:feature.type=='CDS'?'red':'blue'" } },
 *   },
 * }
 * ```
 */

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
