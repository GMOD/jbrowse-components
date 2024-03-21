import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import clone from 'clone'

// locals
import PluginManager from '../PluginManager'
import { getConf } from '../configuration'
import { getSession } from '../util'
import { ElementId } from '../util/types/mst'

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
      featureData: types.frozen(),

      /**
       * #property
       */
      formattedFields: types.frozen(),

      /**
       * #property
       */
      id: ElementId,

      /**
       * #property
       */
      maxDepth: types.maybe(types.number),

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
      type: types.literal('BaseFeatureWidget'),

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
    })
    .volatile(() => ({
      error: undefined as unknown,
    }))

    .actions(self => ({
      /**
       * #action
       */
      clearFeatureData() {
        self.featureData = undefined
      },

      /**
       * #action
       */
      setError(e: unknown) {
        self.error = e
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
      setFeatureData(featureData: Record<string, unknown>) {
        self.unformattedFeatureData = featureData
      },

      /**
       * #action
       */
      setFormattedData(feat: Record<string, unknown>) {
        self.featureData = feat
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
                const feature = clone(unformattedFeatureData)

                const combine = (
                  arg2: string,
                  feature: Record<string, unknown>,
                ) => ({
                  ...getConf(session, ['formatDetails', arg2], { feature }),
                  ...getConf(track, ['formatDetails', arg2], { feature }),
                })

                if (track) {
                  // eslint-disable-next-line no-underscore-dangle
                  feature.__jbrowsefmt = combine('feature', feature)

                  formatSubfeatures(
                    feature,
                    getConf(track, ['formatDetails', 'depth']),
                    sub => {
                      // eslint-disable-next-line no-underscore-dangle
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
        featureData: finalizedFeatureData,
        unformattedFeatureData: featureData,
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      const { unformattedFeatureData, featureData, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >
      // finalizedFeatureData avoids running formatter twice if loading from
      // snapshot
      return {
        // replacing undefined with null helps with allowing fields to be
        // hidden, setting null is not allowed by jexl so we set it to
        // undefined to hide. see config guide. this replacement happens both
        // here and when displaying the featureData in base feature widget
        finalizedFeatureData: JSON.parse(
          JSON.stringify(featureData, (_, v) => (v === undefined ? null : v)),
        ),
        ...rest,
      }
    })
}
