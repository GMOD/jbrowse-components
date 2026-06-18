import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GCContentTrack
 * used for having a gc content track outside of the "reference sequence display"
 *
 * #example
 * A standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence
 * adapter (use this instead of the `ReferenceSequenceTrack` display when you
 * want GC as its own track):
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc',
 *   name: 'GC content',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GCContentAdapter',
 *     sequenceAdapter: {
 *       type: 'IndexedFastaAdapter',
 *       fastaLocation: { uri: 'https://example.com/genome.fa' },
 *       faiLocation: { uri: 'https://example.com/genome.fa.fai' },
 *     },
 *   },
 *   displays: [
 *     {
 *       type: 'LinearGCContentTrackDisplay',
 *       displayId: 'gc-LinearGCContentTrackDisplay',
 *       gcMode: 'skew',
 *     },
 *   ],
 * }
 * ```
 */

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'GCContentTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
