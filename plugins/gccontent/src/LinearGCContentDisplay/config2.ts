import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentTrackDisplay
 * #category display
 * used specifically for GCContentTrack
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
 * }
 * ```
 *
 * #example
 * GC-skew mode with overlapping windows for a smoother signal. The `displays`
 * object shorthand applies settings to whichever display uses them — equivalent
 * to a full `displays: [{ type, displayId, ... }]` array:
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc',
 *   name: 'GC skew',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GCContentAdapter',
 *     sequenceAdapter: {
 *       type: 'IndexedFastaAdapter',
 *       fastaLocation: { uri: 'https://example.com/genome.fa' },
 *       faiLocation: { uri: 'https://example.com/genome.fa.fai' },
 *     },
 *   },
 *   displays: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
 * }
 * ```
 */
export default function LinearGCContentTrackDisplayF(
  pluginManager: PluginManager,
) {
  return ConfigurationSchema(
    'LinearGCContentTrackDisplay',
    {
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      windowDelta: {
        type: 'number',
        defaultValue: 100,
      },
      gcMode: {
        type: 'stringEnum',
        model: types.enumeration('gcMode', ['content', 'skew']),
        defaultValue: 'content',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')
        .configSchema,
      explicitlyTyped: true,
    },
  )
}
