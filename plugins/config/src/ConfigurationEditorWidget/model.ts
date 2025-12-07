import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

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
    .actions(self => ({
      setTarget(newTarget: AnyConfigurationModel | undefined) {
        self.target = newTarget
      },
      afterCreate() {
        let timeout: ReturnType<typeof setTimeout> | undefined
        // Auto-save configuration changes with 400ms debounce. The autorun
        // reacts to any changes in the target configuration model and persists
        // them back to the session after a short delay.
        addDisposer(
          self,
          autorun(() => {
            if (self.target) {
              const snapshot = getSnapshot(self.target)
              clearTimeout(timeout)
              timeout = setTimeout(() => {
                const session = getSession(self)
                session.jbrowse.updateTrackConf(snapshot)
              }, 400)
            }
          }),
        )
      },
    }))
}
