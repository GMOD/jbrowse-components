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
 * GC-skew mode with overlapping windows for a smoother signal. The
 * `displayDefaults` object shorthand applies settings to whichever display uses
 * them — equivalent to a full `displays: [{ type, displayId, ... }]` array. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
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
 *   displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
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
      // GCContentAdapter never emits real per-bin min/max, so the inherited
      // 'whiskers' default has no summary to draw — it just forces posColor-only
      // rendering (buildSourceRenderData skips the bicolor pos/neg split for
      // whiskers) and hides negative GC-skew as if it were positive.
      summaryScoreMode: {
        type: 'stringEnum',
        model: types.enumeration('Score type', [
          'max',
          'min',
          'avg',
          'whiskers',
        ]),
        defaultValue: 'avg',
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
