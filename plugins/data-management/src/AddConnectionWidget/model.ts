import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

export default types.model('AddConnectionModel', {
  id: ElementId,
  type: types.literal('AddConnectionWidget'),
})
