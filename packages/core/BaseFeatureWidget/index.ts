import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import clone from 'clone'

// locals
import PluginManager from '../PluginManager'
import {
  getConf,
  ConfigurationSchema,
  AnyConfigurationModel,
} from '../configuration'
import { getSession } from '../util'
import { ElementId } from '../util/types/mst'

const configSchema = ConfigurationSchema('BaseFeatureWidget', {})

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
    return returnObj
  }
  returnObj.subfeatures = obj.subfeatures?.map(sub => {
    formatSubfeatures(sub, depth, parse, currentDepth + 1, returnObj)
    return parse(sub)
  })
  return returnObj
}

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('BaseFeatureWidget', {
      id: ElementId,
      type: types.literal('BaseFeatureWidget'),
      featureData: types.frozen(),
      formattedFields: types.frozen(),
      unformattedFeatureData: types.frozen(),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      track: types.safeReference(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      trackId: types.maybe(types.string),
      trackType: types.maybe(types.string),
    })
    .actions(self => ({
      setFeatureData(featureData: Record<string, unknown>) {
        self.unformattedFeatureData = featureData
      },
      clearFeatureData() {
        self.featureData = undefined
      },
      setFormattedData(feat: Record<string, unknown>) {
        self.featureData = feat
      },
      setExtra(type?: string, trackId?: string) {
        self.trackId = trackId
        self.trackType = type
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(() => {
            self.setExtra(self.track?.type, self.track?.configuration.trackId)
            const { unformattedFeatureData, track } = self
            const session = getSession(self)
            if (unformattedFeatureData) {
              const feature = clone(unformattedFeatureData)

              const f = (
                obj: { configuration: AnyConfigurationModel },
                arg2: string,
              ) => getConf(obj, ['formatDetails', arg2], { feature })

              if (track) {
                // eslint-disable-next-line no-underscore-dangle
                feature.__jbrowsefmt = {
                  ...f(session, 'feature'),
                  ...f(track, 'feature'),
                }
                const depth = getConf(track, ['formatDetails', 'depth'])
                formatSubfeatures(feature, depth, sub => {
                  // eslint-disable-next-line no-underscore-dangle
                  sub.__jbrowsefmt = {
                    ...f(session, 'subfeature'),
                    ...f(track, 'subfeature'),
                  }
                })
              }

              self.setFormattedData(feature)
            }
          }),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // @ts-ignore
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
      // finalizedFeatureData avoids running formatter twice if loading from
      // snapshot
      return {
        // replacing undefined with null helps with allowing fields to be
        // hidden, setting null is not allowed by jexl so we set it to
        // undefined to hide. see config guide. this replacement happens both
        // here and when displaying the featureData in base feature widget
        finalizedFeatureData: JSON.parse(
          JSON.stringify(featureData, (_, v) =>
            typeof v === 'undefined' ? null : v,
          ),
        ),
        ...rest,
      }
    })
}

export { configSchema, stateModelFactory }
