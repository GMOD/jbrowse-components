import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

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
      // The target is an MST model from track.configuration (which creates
      // an MST model from frozen config via ConfigurationReference).
      target: undefined as AnyConfigurationModel | undefined,
    }))
    .views(self => ({
      get effectiveTarget() {
        return self.target
      },
    }))
    .actions(self => ({
      setTarget(newTarget: AnyConfigurationModel | undefined) {
        self.target = newTarget
      },
      /**
       * #action
       * Saves the current configuration back to the frozen tracks array.
       * This is needed because track.configuration creates an MST model
       * from frozen data, and edits need to be persisted back.
       */
      saveConfig() {
        if (!self.target) {
          return
        }
        const snapshot = getSnapshot(self.target)
        const session = getSession(self)
        // @ts-expect-error jbrowse may not exist on all session types
        const jbrowse = session.jbrowse
        if (jbrowse?.updateTrackConf) {
          jbrowse.updateTrackConf(snapshot)
        }
      },
    }))
}
