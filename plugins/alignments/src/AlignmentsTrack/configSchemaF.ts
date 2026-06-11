import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config AlignmentsTrack
 * has very little config; most config and state logic is on the display
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
 * The same track with appearance settings in place. Rather than writing out the
 * full `displays` array, you can list them in a `displays` object — JBrowse works
 * out which display they belong to and applies them for you (here, the
 * `LinearAlignmentsDisplay`), so you don't have to know display names:
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
 *   displays: { colorBy: { type: 'pairOrientation' }, height: 250 },
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
