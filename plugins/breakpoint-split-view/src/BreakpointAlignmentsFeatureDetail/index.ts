import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

const configSchema = ConfigurationSchema('BreakpointAlignmentsWidget', {})

const stateModel = types
  .model('BreakpointAlignmentsWidget', {
    id: ElementId,
    type: types.literal('BreakpointAlignmentsWidget'),
    featureData: types.frozen(),
  })
  .actions(self => ({
    setFeatureData(data: unknown) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = undefined
    },
  }))

export { configSchema, stateModel }
