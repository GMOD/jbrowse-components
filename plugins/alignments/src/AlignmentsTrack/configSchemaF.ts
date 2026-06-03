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
