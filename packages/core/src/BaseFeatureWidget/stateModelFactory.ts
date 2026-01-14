import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { getConf } from '../configuration/index.ts'
import { getSession } from '../util/index.ts'
import { SequenceFeatureDetailsF } from './SequenceFeatureDetails/model.ts'
import { formatSubfeatures } from './util.tsx'
import { ElementId } from '../util/types/mst.ts'

import type PluginManager from '../PluginManager.ts'
import type { MaybeSerializedFeat } from './types.tsx'
import type { SimpleFeatureSerialized } from '../util/index.ts'
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
      featureData: types.frozen<MaybeSerializedFeat>(),

      /**
       * #property
       */
      formattedFields: types.frozen(),

      /**
       * #property
       */
      unformattedFeatureData: types.frozen<MaybeSerializedFeat>(),

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
      descriptions: types.frozen<Record<string, unknown> | undefined>(),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      error: undefined as unknown,
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
                    arg2: string,
                    feature: Record<string, unknown>,
                  ) => ({
                    ...getConf(session, ['formatDetails', arg2], { feature }),
                    ...getConf(track, ['formatDetails', arg2], { feature }),
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
    .preProcessSnapshot(snap => {
      // @ts-expect-error
      const { featureData, finalizedFeatureData, ...rest } = snap
      return {
        unformattedFeatureData: featureData,
        featureData: finalizedFeatureData,
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
      const { unformattedFeatureData, featureData, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >

      const s2 = JSON.stringify(featureData, (_, v) =>
        v === undefined ? null : v,
      )

      // JSON.stringify can return empty if too large

      const featureTooLargeToBeSerialized = !s2 || s2.length > 2_000_000

      // The concept of using `finalizedFeatureData` is to avoid running
      // formatter twice if loading from snapshot
      return {
        // We replace undefined with null to help with allowing fields to be
        // hidden, setting null is not allowed by jexl so we set it to
        // undefined to hide, but JSON only allows serializing null
        finalizedFeatureData: featureTooLargeToBeSerialized
          ? undefined
          : JSON.parse(s2),
        ...rest,
      }
    })
}

export type BaseFeatureWidgetStateModel = ReturnType<typeof stateModelFactory>
export type BaseFeatureWidgetModel = Instance<BaseFeatureWidgetStateModel>
