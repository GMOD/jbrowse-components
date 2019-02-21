import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'
import { assemblyFactory } from '../../rootModel'

export default pluginManager =>
  types
    .model('ConfigurationEditorDrawerWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorDrawerWidget'),
      target: types.reference(
        types.union(
          pluginManager.pluggableConfigSchemaType('track'),
          pluginManager.pluggableConfigSchemaType('view'),
          assemblyFactory(pluginManager),
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
