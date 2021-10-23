import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('VariantFeatureWidget', {})

export function stateModelFactory(pluginManager) {
  return types
    .model('VariantFeatureWidget', {
      id: ElementId,
      type: types.literal('VariantFeatureWidget'),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      featureData: types.frozen(),
      descriptions: types.frozen(),
    })
    .actions(self => ({
      setFeatureData(data) {
        self.featureData = data
      },
      clearFeatureData() {
        self.featureData = undefined
      },
    }))
}
