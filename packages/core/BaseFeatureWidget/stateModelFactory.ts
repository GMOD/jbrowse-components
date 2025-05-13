import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

import { getConf } from '../configuration'
import { getSession } from '../util'
import { SequenceFeatureDetailsF } from './SequenceFeatureDetails/model'
import { replaceUndefinedWithNull } from './util'
import { ElementId } from '../util/types/mst'

import type PluginManager from '../PluginManager'
import type { Instance } from 'mobx-state-tree'

interface Feat {
  subfeatures?: Record<string, unknown>[]
}

function formatSubfeatures(
  obj: Feat,
  depth: number,
  parse: (obj: Record<string, unknown>) => void,
  currentDepth = 0,
  returnObj = {} as Record<string, unknown>,
) {
  if (depth <= currentDepth) {
    return
  }
  obj.subfeatures?.map(sub => {
    formatSubfeatures(sub, depth, parse, currentDepth + 1, returnObj)
    parse(sub)
  })
}

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
      featureData: types.frozen(),
      /**
       * #property
       */
      formattedFields: types.frozen(),
      /**
       * #property
       */
      unformattedFeatureData: types.frozen(),
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
      descriptions: types.frozen(),
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
      setFeatureData(featureData: Record<string, unknown>) {
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
      setFormattedData(feat: Record<string, unknown>) {
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
          autorun(() => {
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
          }),
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
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      const { unformattedFeatureData, featureData, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >

      // We check if feature has individually large attributes, because a full
      // JSON.stringify is (1) expensive and (2) can exceed string length
      // limits. This check catches single large attributes. Very large nested
      // features e.g. gene with many many isoforms will not be caught by this
      let featureHasLargeAttributes = false
      for (const r in featureData) {
        if (featureData[r]?.length > 1_000_000) {
          featureHasLargeAttributes = true
        }
      }

      // The concept of using `finalizedFeatureData` is to avoid running
      // formatter twice if loading from snapshot
      return {
        // We replace undefined with null to help with allowing fields to be
        // hidden, setting null is not allowed by jexl so we set it to
        // undefined to hide, but JSON only allows serializing null
        finalizedFeatureData: featureHasLargeAttributes
          ? undefined
          : replaceUndefinedWithNull(featureData),
        ...rest,
      }
    })
}

export type BaseFeatureWidgetStateModel = ReturnType<typeof stateModelFactory>
export type BaseFeatureWidgetModel = Instance<BaseFeatureWidgetStateModel>
