import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export default function stateModelFactory(_pluginManager: PluginManager) {
  return types
    .model('ConfigurationEditorWidget', {
      id: ElementId,
      type: types.literal('ConfigurationEditorWidget'),
    })
    .volatile(() => ({
      // Target is stored as volatile since it doesn't need to be serialized.
      // The target is either an MST model from sessionTracks or a temporary
      // MST model created from frozen jbrowse.tracks for editing.
      target: undefined as AnyConfigurationModel | undefined,
    }))
    .views(self => ({
      // Alias for backwards compatibility with components using effectiveTarget
      get effectiveTarget() {
        return self.target
      },
    }))
    .actions(self => ({
      setTarget(newTarget: AnyConfigurationModel | undefined) {
        self.target = newTarget
      },
    }))
}
