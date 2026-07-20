import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { getConf } from '../configuration/index.ts'
import { getSession } from '../util/index.ts'
import { ElementId } from '../util/types/mst.ts'
import { SequenceFeatureDetailsF } from './SequenceFeatureDetails/model.ts'
import { formatSubfeatures, nullReplacer } from './util.tsx'

import type PluginManager from '../PluginManager.ts'
import type { SimpleFeatureSerialized } from '../util/index.ts'
import type { MaybeSerializedFeat } from './types.tsx'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel BaseFeatureWidget
 * displays data about features, allowing configuration callbacks to modify the
 * contents of what is displayed
 *
 * see: formatDetails-\>feature,formatDetails-\>subfeatures
 */
export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('BaseFeatureWidget', {
      /**
       * #property
       */
      id: ElementId,

      /**
       * #property
       */
      type: types.literal('BaseFeatureWidget'),

      /**
       * #property
       */
      featureData: types.optional(
        types.frozen<MaybeSerializedFeat>(),
        undefined,
      ),

      /**
       * #property
       */
      unformattedFeatureData: types.optional(
        types.frozen<MaybeSerializedFeat>(),
        undefined,
      ),

      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),

      /**
       * #property
       */
      track: types.safeReference(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),

      /**
       * #property
       */
      trackId: types.maybe(types.string),

      /**
       * #property
       */
      trackType: types.maybe(types.string),

      /**
       * #property
       */
      maxDepth: types.maybe(types.number),

      /**
       * #property
       */
      sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {}),

      /**
       * #property
       */
      descriptions: types.optional(
        types.frozen<Record<string, unknown> | undefined>(),
        undefined,
      ),
    })
    .volatile<{ error: unknown }>(() => ({
      /**
       * #volatile
       */

      error: undefined,
    }))

    .actions(self => ({
      /**
       * #action
       */
      setFeatureData(featureData: SimpleFeatureSerialized) {
        self.unformattedFeatureData = featureData
      },
      /**
       * #action
       */
      clearFeatureData() {
        self.featureData = undefined
      },
      /**
       * #action
       */
      setFormattedData(feat: SimpleFeatureSerialized) {
        self.featureData = feat
      },
      /**
       * #action
       */
      setExtra(type?: string, trackId?: string, maxDepth?: number) {
        self.trackId = trackId
        self.trackType = type
        self.maxDepth = maxDepth
      },
      /**
       * #action
       */
      setError(e: unknown) {
        self.error = e
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            function featureWidgetAutorun() {
              try {
                const { unformattedFeatureData, track } = self
                const session = getSession(self)
                if (track) {
                  self.setExtra(
                    track.type,
                    track.configuration.trackId,
                    getConf(track, ['formatDetails', 'maxDepth']),
                  )
                }
                if (unformattedFeatureData) {
                  const feature = structuredClone(unformattedFeatureData)

                  const combine = (
                    scope: string,
                    feature: Record<string, unknown>,
                  ) => ({
                    ...getConf(session, ['formatDetails', scope], { feature }),
                    ...getConf(track, ['formatDetails', scope], { feature }),
                  })

                  if (track) {
                    feature.__jbrowsefmt = combine('feature', feature)

                    formatSubfeatures(
                      feature,
                      getConf(track, ['formatDetails', 'depth']),
                      sub => {
                        sub.__jbrowsefmt = combine('subfeatures', sub)
                      },
                    )
                  }

                  self.setFormattedData(feature)
                }
              } catch (e) {
                console.error(e)
                self.setError(e)
              }
            },
            { name: 'FeatureWidget' },
          ),
        )
      },
    }))
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      // old snapshots used `featureData`, new ones use `finalizedFeatureData`;
      // accept both for backwards compat
      const { featureData, finalizedFeatureData, ...rest } = (snap ?? {}) as {
        featureData?: MaybeSerializedFeat
        finalizedFeatureData?: MaybeSerializedFeat
      } & Record<string, unknown>
      return {
        unformattedFeatureData: featureData,
        featureData: finalizedFeatureData,
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      const { unformattedFeatureData, featureData, ...rest } = snap

      // JSON.stringify can return empty if too large
      const s2 = JSON.stringify(featureData, nullReplacer)
      const featureTooLargeToBeSerialized = !s2 || s2.length > 2_000_000

      // `finalizedFeatureData` is persisted (rather than `featureData`) so
      // loading from snapshot doesn't re-run the formatter callbacks
      return {
        finalizedFeatureData: featureTooLargeToBeSerialized
          ? undefined
          : JSON.parse(s2),
        ...rest,
      }
    })
}

export type BaseFeatureWidgetStateModel = ReturnType<typeof stateModelFactory>
export type BaseFeatureWidgetModel = Instance<BaseFeatureWidgetStateModel>
