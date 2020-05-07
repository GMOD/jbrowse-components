import { types } from 'mobx-state-tree'
import { ElementId } from '../../util/types/mst'

export default pluginManager =>
  types.model('HelloWorldMenuBar', {
    id: ElementId,
    type: types.literal('HelloWorldMenuBar'),
  })
