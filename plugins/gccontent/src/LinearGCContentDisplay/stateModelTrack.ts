import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import SharedModelF from './shared.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearGCContentTrackDisplay
 * #category display
 *
 * used on GCContentTrack, separately from the display type on the
 * ReferenceSequenceTrack
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
export default function stateModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearGCContentTrackDisplay',
      SharedModelF(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearGCContentTrackDisplay'),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * applies the current display parameter overrides to the parent
       * GCContentTrack's adapter.
       *
       * The canonical config gives the track a GCContentAdapter (see the
       * #example above), which is used as-is. But a GCContentTrack may also
       * name a bare sequence adapter: that was the only shape that worked
       * before the display stopped wrapping unconditionally, and it shipped in
       * our own volvox configs long enough to be out in the wild. Wrapping it
       * here keeps those configs rendering — left unwrapped, the sequence
       * adapter's featureless output reaches the wiggle as an empty domain and
       * the track draws an axis with no data, silently and with no error.
       */
      get adapterConfig() {
        const adapter = getConf(self.parentTrack, 'adapter')
        const gcContentAdapter =
          adapter.type === 'GCContentAdapter'
            ? adapter
            : { type: 'GCContentAdapter', sequenceAdapter: adapter }
        return {
          ...gcContentAdapter,
          windowSize: self.windowSize,
          windowDelta: self.windowDelta,
          gcMode: self.gcMode,
        }
      },
    }))
}
