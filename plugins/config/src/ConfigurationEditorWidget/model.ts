import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SessionWithConfigEditing } from '@jbrowse/core/util'

/**
 * #stateModel ConfigurationEditorWidget
 * Widget for editing a config model's slots in a form: holds the target
 * configuration and debounce-saves edits back to the session.
 */
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
      // displayId of the display active in the view this editor was opened
      // from; its config accordion expands by default while the track's other
      // (incompatible/inactive) displays start collapsed
      expandedDisplayId: undefined as string | undefined,
    }))
    .actions(self => ({
      setTarget(newTarget: AnyConfigurationModel | undefined) {
        self.target = newTarget
      },
      setExpandedDisplayId(displayId: string | undefined) {
        self.expandedDisplayId = displayId
      },
      afterCreate() {
        let timeout: ReturnType<typeof setTimeout> | undefined
        // Auto-save configuration changes with 400ms debounce. The autorun
        // reacts to any changes in the target configuration model and persists
        // them back to the session after a short delay via
        // updateTrackConfiguration, which routes admin edits to the jbrowse
        // config in place and everyone else's to a shareable session-track
        // override. It keys off trackId, so this widget is only safe to open on
        // track configs (see editConfiguration, which enforces a trackId).
        // Non-track configs (assembly/connection) edit the ConfigurationEditor
        // component directly and mutate live nodes in place.
        addDisposer(
          self,
          autorun(() => {
            if (self.target) {
              // the widget only opens on track configs (see comment above), so
              // the snapshot always carries a trackId
              const snapshot = getSnapshot(self.target) as {
                trackId: string
                [key: string]: unknown
              }
              clearTimeout(timeout)
              timeout = setTimeout(() => {
                const session = getSession(self) as SessionWithConfigEditing
                session.updateTrackConfiguration(snapshot)
              }, 400)
            }
          }),
        )
        // ensure a pending debounced save can't fire after disposal, where
        // getSession(self) would throw on the now-detached node
        addDisposer(self, () => {
          clearTimeout(timeout)
        })
      },
    }))
}
