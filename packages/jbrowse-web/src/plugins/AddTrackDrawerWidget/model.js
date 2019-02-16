import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'

export default pluginManager =>
  types.model('AddTrackModel', {
    id: ElementId,
    type: types.literal('AddTrackDrawerWidget'),
    view: types.reference(pluginManager.pluggableMstType('view', 'stateModel')),
  })
