import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'

export default jbrowse => {
  const { types } = jbrowse.jbrequire('mobx-state-tree')
  const configSchema = ConfigurationSchema('GDCFeatureDrawerWidget', {})
  const stateModel = types
    .model('GDCFeatureDrawerWidget', {
      id: ElementId,
      type: types.literal('GDCFeatureDrawerWidget'),
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

  const ReactComponent = jbrowse.jbrequire(require('./GDCFeatureDrawerWidget'))

  return { configSchema, stateModel, ReactComponent }
}
