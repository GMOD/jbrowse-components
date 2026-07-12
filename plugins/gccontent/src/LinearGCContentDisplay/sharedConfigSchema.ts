import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config SharedGCContentDisplay
 * #category display
 *
 * Shared config for the two GC content displays: `LinearGCContentDisplay` (on a
 * `ReferenceSequenceTrack`, deriving GC from the track's own sequence adapter)
 * and `LinearGCContentTrackDisplay` (on a standalone `GCContentTrack`). Both
 * register the same slots against different track types, so the slots live here
 * once.
 *
 * #example
 * On a `ReferenceSequenceTrack` — no extra adapter needed, GC is derived from
 * the track's sequence adapter. `gcMode` is `content` or `skew`:
 * ```js
 * {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'refseq',
 *   name: 'Reference sequence',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'IndexedFastaAdapter',
 *     uri: 'https://example.com/genome.fa',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearGCContentDisplay',
 *       displayId: 'refseq-LinearGCContentDisplay',
 *       windowSize: 100,
 *       windowDelta: 100,
 *       gcMode: 'content',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * On a standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence
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
 *   displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
 * }
 * ```
 */
export default function sharedGCContentConfigSchema(
  pluginManager: PluginManager,
) {
  return ConfigurationSchema(
    'SharedGCContentDisplay',
    {
      /**
       * #slot
       * Number of bases per GC measurement window.
       */
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       * Step between successive windows; smaller than `windowSize` means
       * overlapping windows (a smoother signal).
       */
      windowDelta: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       * `content` for GC percentage, `skew` for (G-C)/(G+C) strand skew.
       */
      gcMode: {
        type: 'stringEnum',
        model: types.enumeration('gcMode', ['content', 'skew']),
        defaultValue: 'content',
      },
      /**
       * #slot
       * GCContentAdapter never emits real per-bin min/max, so the inherited
       * 'whiskers' default has no summary to draw — it just forces posColor-only
       * rendering (buildSourceRenderData skips the bicolor pos/neg split for
       * whiskers) and hides negative GC-skew as if it were positive.
       */
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
