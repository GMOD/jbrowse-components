import { types } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'

export default pluginManager =>
  types.model('AddTrackModel', {
    id: ElementId,
    type: types.literal('AddTrackWidget'),
    view: types.safeReference(
      pluginManager.pluggableMstType('view', 'stateModel'),
    ),
  })
