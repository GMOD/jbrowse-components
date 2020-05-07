import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'
import { ElementId } from '../util/types/mst'

const configSchema = ConfigurationSchema('BaseFeatureDrawerWidget', {})

const stateModel = types
  .model('BaseFeatureDrawerWidget', {
    id: ElementId,
    type: types.literal('BaseFeatureDrawerWidget'),
    featureData: types.frozen({}),
  })
  .actions(self => ({
    setFeatureData(data) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = {}
    },
  }))

export { configSchema, stateModel }
export const ReactComponent = import('./BaseFeatureDetail')
