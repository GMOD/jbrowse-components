import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'
import { types } from 'mobx-state-tree'

export const configSchema = ConfigurationSchema(
  'VariantFeatureDrawerWidget',
  {},
)
export const stateModel = types
  .model('VariantFeatureDrawerWidget', {
    id: ElementId,
    type: types.literal('VariantFeatureDrawerWidget'),
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

export const ReactComponent = import('./VariantFeatureDrawerWidget')
