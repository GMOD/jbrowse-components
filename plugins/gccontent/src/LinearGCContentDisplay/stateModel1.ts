import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getSession,
  isSessionWithAddTracks,
  makeTrackId,
} from '@jbrowse/core/util'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import SharedModelF from './shared.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  return types
    .compose(
      'LinearGCContentDisplay',
      SharedModelF(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearGCContentDisplay'),
      }),
    )
    .actions(self => ({
      /**
       * #action
       * spins up a standalone GCContentTrack session track that wraps the
       * parent ReferenceSequenceTrack's sequence adapter, carrying the current
       * display parameters
       */
      addGCContentTrack() {
        const session = getSession(self)
        if (isSessionWithAddTracks(session)) {
          const name = self.gcMode === 'skew' ? 'GC skew' : 'GC content'
          const trackId = makeTrackId({
            name,
            adminMode: !!session.adminMode,
          })
          session.addTrackConf({
            trackId,
            type: 'GCContentTrack',
            name,
            assemblyNames: getTrackAssemblyNames(self.parentTrack),
            adapter: {
              type: 'GCContentAdapter',
              sequenceAdapter: getConf(self.parentTrack, 'adapter'),
            },
            displays: [
              {
                type: 'LinearGCContentTrackDisplay',
                windowSize: self.windowSize,
                windowDelta: self.windowDelta,
                gcMode: self.gcMode,
              },
            ],
          })
          ;(getContainingView(self) as LinearGenomeViewModel).showTrack(trackId)
        }
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #getter
         * wraps the parent ReferenceSequenceTrack's sequence adapter in a
         * GCContentAdapter
         */
        get adapterConfig() {
          return {
            type: 'GCContentAdapter',
            sequenceAdapter: getConf(self.parentTrack, 'adapter'),
            windowSize: self.windowSize,
            windowDelta: self.windowDelta,
            gcMode: self.gcMode,
          }
        },
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Add GC content track',
              onClick: () => {
                self.addGCContentTrack()
              },
            },
          ]
        },
      }
    })
}
