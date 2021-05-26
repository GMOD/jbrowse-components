import { types } from 'mobx-state-tree'
import PluginManager from '../PluginManager'
import { ConfigurationSchema } from '../configuration'
import { ElementId } from '../util/types/mst'

const configSchema = ConfigurationSchema('BaseFeatureWidget', {})

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('BaseFeatureWidget', {
      id: ElementId,
      type: types.literal('BaseFeatureWidget'),
      featureData: types.frozen(),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .actions(self => ({
      setFeatureData(data: Record<string, unknown>) {
        self.featureData = data
      },
      clearFeatureData() {
        self.featureData = undefined
      },
    }))
}

export { configSchema, stateModelFactory }
