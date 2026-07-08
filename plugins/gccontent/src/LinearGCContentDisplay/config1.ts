import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay
 * #category display
 *
 * #example
 * This display attaches to a `ReferenceSequenceTrack` — it derives GC from the
 * track's own sequence adapter, so no extra adapter is needed. `gcMode` is
 * `content` or `skew`:
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
 */
export default function LinearGCContentDisplay(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
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
