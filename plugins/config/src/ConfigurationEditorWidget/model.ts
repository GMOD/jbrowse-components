import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('ConfigurationEditorWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorWidget'),
      // If you add different types of targets, don't forget to account for that
      // in the key of ./components/ConfigurationEditor.js
      target: types.safeReference(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
    })
    .actions(self => ({
      setTarget(newTarget: any) {
        self.target = newTarget
      },
    }))
}
