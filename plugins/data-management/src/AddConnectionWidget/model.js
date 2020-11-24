import { types } from 'mobx-state-tree'
import { ElementId } from '@jbrowse/core/util/types/mst'

export default types.model('AddConnectionModel', {
  id: ElementId,
  type: types.literal('AddConnectionWidget'),
})
