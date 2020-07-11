import { types } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'

export default pluginManager =>
  types
    .model('ConfigurationEditorWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorWidget'),
      // If you add different types of targets, don't forget to account for that
      // in the key of ./components/ConfigurationEditor.js
      target: types.safeReference(
        pluginManager.pluggableConfigSchemaType('track'),
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
