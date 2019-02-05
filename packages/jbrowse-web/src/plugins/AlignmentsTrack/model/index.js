import { types } from 'mobx-state-tree'
import { ElementId } from '../../../mst-types'
import AlignmentsTrack from './alignmentsTrack'

export default AlignmentsTrack

export const AlignmentsFeatureDrawerWidgetModel = types
  .model('AlignmentsFeatureDrawerWidget', {
    id: ElementId,
    type: types.literal('AlignmentsFeatureDrawerWidget'),
  })
  .volatile(() => ({
    featureData: {},
  }))
  .actions(self => ({
    setFeatureData(data) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = {}
    },
  }))
