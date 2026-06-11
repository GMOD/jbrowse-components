import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config FeatureTrack
 * #category track
 * used for basic gene and feature tracks, generally used with LinearBasicDisplay
 *
 * #example
 * A minimal hand-authored entry in the top-level `tracks` array — `adapter`
 * points at the data file, and the track opens with a `LinearBasicDisplay`:
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
 * The same track, colored. Rather than writing out the full `displays` array,
 * you can put appearance settings in a `displays` object — JBrowse works out
 * which display they belong to and applies them for you (here, the track's
 * `LinearBasicDisplay`), so you don't have to know display names. A `jexl:`
 * value gives per-feature coloring:
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
 *   displays: { color: "jexl:get(feature,'type')=='CDS'?'red':'blue'" },
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
