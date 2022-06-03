import { types } from 'mobx-state-tree'
import PluginManager from '../PluginManager'
import { getConf, ConfigurationSchema } from '../configuration'
import { ElementId } from '../util/types/mst'

const configSchema = ConfigurationSchema('BaseFeatureWidget', {})

function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null
}

function iterate(
  obj: Record<string, unknown>,
  parse: (key: string, value: unknown, obj: Record<string, unknown>) => void,
) {
  for (const k in obj) {
    const r = obj[k]
    if (isObject(r)) {
      iterate(r, parse)
    } else if (obj.hasOwnProperty(k)) {
      parse(k, r, obj)
    }
  }
}

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
    .actions(self => ({
      setFeatureData(feature: Record<string, unknown>) {
        let trackExtra = {}

        iterate(feature, (key, val, obj) => {
          if (key === 'id') {
            obj.origId = val
          }
          if (key === 'name') {
            obj.origName = val
          }
          if (key === 'type') {
            obj.origType = val
          }
        })

        if (self.track) {
          const ret = getConf(self.track, ['formatFields'], { feature })
          if (ret) {
            trackExtra = ret
          }

          iterateSubfeatures(feature, obj => {
            const r = getConf(self.track, ['formatFieldsNested'], {
              feature: obj,
            })
            return r ? { ...obj, ...r } : obj
          })
        }

        self.featureData = { ...feature, ...trackExtra }
      },
      clearFeatureData() {
        self.featureData = undefined
      },
    }))
}

export { configSchema, stateModelFactory }
