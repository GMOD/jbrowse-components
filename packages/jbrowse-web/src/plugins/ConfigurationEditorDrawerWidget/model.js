import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'
import { Assembly } from '../../rootModel'

export default pluginManager =>
  types
    .model('ConfigurationEditorDrawerWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorDrawerWidget'),
      target: types.reference(
        types.union(
          pluginManager.pluggableConfigSchemaType('track'),
          pluginManager.pluggableConfigSchemaType('view'),
          Assembly,
        ),
      ),
    })
    // .volatile(() => ({
    //   target: undefined,
    // }))
    .actions(self => ({
      setTarget(newTarget) {
        self.target = newTarget
      },
    }))
//    .views(self => ({}))
