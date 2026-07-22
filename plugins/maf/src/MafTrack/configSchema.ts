import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MafTrack
 * #category track
 * used for multiple alignment (MAF/TAF) tracks, rendered as one row per aligned
 * species with a conservation summary above them
 *
 * #example
 * A tabix-indexed MAF, with the aligned species supplied by a Newick tree that
 * also orders and labels the rows as a dendrogram (pass a `samples` array
 * instead to list them explicitly, in track order):
 * ```js
 * {
 *   type: 'MafTrack',
 *   trackId: 'ce11.26way',
 *   name: 'UCSC 26-way multiple alignment',
 *   assemblyNames: ['ce11'],
 *   adapter: {
 *     type: 'MafTabixAdapter',
 *     uri: 'https://jbrowse.org/demos/ce/ce11.26way.bed.gz',
 *     nhLocation: {
 *       uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/ce11/multiz26way/ce11.26way.nh',
 *     },
 *   },
 * }
 * ```
 */
export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'MafTrack',
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
}
