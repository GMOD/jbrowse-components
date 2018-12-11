import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'

export default types.model('DataHubModel', {
  id: ElementId,
  type: types.literal('DataHubDrawerWidget'),
})
