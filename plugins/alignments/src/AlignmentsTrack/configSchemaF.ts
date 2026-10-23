import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config AlignmentsTrack
 * Holds read alignments, such as a BAM or CRAM file, which
 * `LinearAlignmentsDisplay` draws. The track has few settings, and the display
 * holds most of the config and state.
 *
 * #example
 * A BAM track — swap the adapter to `CramAdapter` with a `uri` to a `.cram` for
 * CRAM:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs-reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BamAdapter',
 *     uri: 'https://example.com/sample.bam',
 *   },
 * }
 * ```
 *
 * #example
 * `AlignmentsTrack` with appearance settings in place. Rather than writing out the
 * full `displays` array, you can list them in a `displayDefaults` object —
 * JBrowse works out which display they belong to and applies them for you (here,
 * the `LinearAlignmentsDisplay`), so you don't have to know display names:
 * ```js
 * {
 *   type: 'AlignmentsTrack',
 *   trackId: 'ngs-reads',
 *   name: 'NGS reads',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BamAdapter',
 *     uri: 'https://example.com/sample.bam',
 *   },
 *   displayDefaults: { encoding: { color: 'pairOrientation' }, height: 250 },
 * }
 * ```
 */
export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'AlignmentsTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}
