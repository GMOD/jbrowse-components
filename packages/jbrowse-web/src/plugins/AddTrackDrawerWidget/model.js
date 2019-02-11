import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'

export default types.model('AddTrackModel', {
  id: ElementId,
  type: types.literal('AddTrackDrawerWidget'),
})
