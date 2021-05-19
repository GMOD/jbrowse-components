import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

const configSchema = ConfigurationSchema('AlignmentsFeatureWidget', {})

export default function stateModelFactory(pluginManager) {
  return types
    .model('AlignmentsFeatureWidget', {
      id: ElementId,
      type: types.literal('AlignmentsFeatureWidget'),
      featureData: types.frozen(),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
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

export { configSchema, stateModelFactory }
