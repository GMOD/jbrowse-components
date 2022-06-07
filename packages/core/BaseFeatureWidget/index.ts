import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import PluginManager from '../PluginManager'
import { getConf, ConfigurationSchema } from '../configuration'
import clone from 'clone'
import { ElementId } from '../util/types/mst'

const configSchema = ConfigurationSchema('BaseFeatureWidget', {})

function iterateSubfeatures(
  obj: Record<string, unknown>,
  parse: (obj: Record<string, unknown>) => void,
) {
  if (obj.subfeatures) {
    // @ts-ignore
    obj.subfeatures = obj.subfeatures.map(sub => {
      iterateSubfeatures(sub, parse)
      return parse(sub)
    })
  }
}

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('BaseFeatureWidget', {
      id: ElementId,
      type: types.literal('BaseFeatureWidget'),
      featureData: types.frozen(),
      unformattedFeatureData: types.frozen(),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      track: types.safeReference(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      display: types.safeReference(
        pluginManager.pluggableMstType('display', 'stateModel'),
      ),
    })
    .volatile(() => ({}))
    .actions(self => ({
      setFeatureData(featureData: Record<string, unknown>) {
        self.unformattedFeatureData = featureData
      },
      clearFeatureData() {
        self.featureData = undefined
      },
      setFormattedFeatureData(feat: Record<string, unknown>) {
        self.featureData = feat
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(() => {
            const { unformattedFeatureData, track } = self
            if (unformattedFeatureData) {
              const feature = clone(unformattedFeatureData)
              let trackExtra = {}

              if (self.track) {
                const ret = getConf(track, ['formatFields'], { feature })
                if (ret) {
                  trackExtra = ret
                }

                iterateSubfeatures(feature, subfeature => {
                  const r =
                    getConf(track, ['formatSubfeatureFields'], {
                      feature: subfeature,
                    }) || {}
                  return { ...subfeature, ...r }
                })
              }

              self.setFormattedFeatureData({ ...feature, ...trackExtra })
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
      const { unformattedFeatureData, featureData, ...rest } = snap
      // finalizedFeatureData avoids running formatter twice if loading from
      // snapshot
      return { finalizedFeatureData: featureData, ...rest }
    })
}

export { configSchema, stateModelFactory }
