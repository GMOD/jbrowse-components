import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

const configSchema = ConfigurationSchema('AlignmentsFeatureWidget', {})

const stateModel = types
  .model('AlignmentsFeatureWidget', {
    id: ElementId,
    type: types.literal('AlignmentsFeatureWidget'),
    featureData: types.frozen(),
  })
  .actions(self => ({
    setFeatureData(data) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = undefined
    },
  }))

export { configSchema, stateModel }
export { default as ReactComponent } from './AlignmentsFeatureDetail'
