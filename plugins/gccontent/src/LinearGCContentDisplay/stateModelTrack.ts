import { types } from '@jbrowse/mobx-state-tree'

import SharedModelF from './shared.tsx'

import type { LinearGCContentDisplayConfigSchema } from './index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel LinearGCContentTrackDisplay
 * #category display
 *
 * used on GCContentTrack, separately from the display type on the
 * ReferenceSequenceTrack. A GCContentTrack may also name a bare sequence
 * adapter, which `gcAdapterConfig` wraps.
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
 *   adapter: { type: 'GCContentAdapter' },
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
  configSchema: LinearGCContentDisplayConfigSchema,
) {
  return types.compose(
    'LinearGCContentTrackDisplay',
    SharedModelF(pluginManager, configSchema),
    types.model({
      type: types.literal('LinearGCContentTrackDisplay'),
    }),
  )
}
