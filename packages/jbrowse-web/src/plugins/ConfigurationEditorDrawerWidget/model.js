import { types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'

export default pluginManager =>
  types
    .model('ConfigurationEditorDrawerWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorDrawerWidget'),
      target: types.reference(
        types.union(
          pluginManager.pluggableConfigSchemaType('track'),
          pluginManager.pluggableConfigSchemaType('view'),
          pluginManager.rootConfig.type.properties.assemblies.type.subType.type,
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
