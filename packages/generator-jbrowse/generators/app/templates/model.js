import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'

export default pluginManager =>
  types.model('HelloWorldMenuBar', {
    id: ElementId,
    type: types.literal('HelloWorldMenuBar'),
  })
