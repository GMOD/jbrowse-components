import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'
import { ElementId } from '../util/types/mst'

const configSchema = ConfigurationSchema('BaseFeatureWidget', {})

const stateModel = types
  .model('BaseFeatureWidget', {
    id: ElementId,
    type: types.literal('BaseFeatureWidget'),
    featureData: types.frozen({}),
  })
  .actions(self => ({
    setFeatureData(data: Record<string, unknown>) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = {}
    },
  }))

export { configSchema, stateModel }
export const ReactComponent = import('./BaseFeatureDetail').then(
  d => d.BaseFeatureDetails,
)
