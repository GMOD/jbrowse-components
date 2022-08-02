import { types } from 'mobx-state-tree'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

export default (pluginManager: PluginManager) =>
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
    .actions(self => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTarget(newTarget: any) {
        self.target = newTarget
      },
    }))
