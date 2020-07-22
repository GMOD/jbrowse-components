import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema('VariantFeatureWidget', {})
export const stateModel = types
  .model('VariantFeatureWidget', {
    id: ElementId,
    type: types.literal('VariantFeatureWidget'),
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

export { default as ReactComponent } from './VariantFeatureWidget'
