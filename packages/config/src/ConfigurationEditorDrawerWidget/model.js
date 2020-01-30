import { types } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/mst-types'

export default pluginManager =>
  types
    .model('ConfigurationEditorDrawerWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorDrawerWidget'),
      // If you add different types of targets, don't forget to account for that
      // in the key of ./components/ConfigurationEditor.js
      target: types.safeReference(
        types.union(
          pluginManager.pluggableConfigSchemaType('track'),
          pluginManager.pluggableConfigSchemaType('view'),
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
