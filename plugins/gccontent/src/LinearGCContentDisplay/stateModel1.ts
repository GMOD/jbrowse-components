import { types } from '@jbrowse/mobx-state-tree'

import SharedModelF from './shared.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearGCContentDisplay
 * #category display
 * base model `SharedGCContentModel`
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
export default function stateModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types.compose(
    'LinearGCContentDisplay',
    SharedModelF(pluginManager, configSchema),
    types.model({
      type: types.literal('LinearGCContentDisplay'),
    }),
  )
}
