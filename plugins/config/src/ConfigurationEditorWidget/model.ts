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
        // config in place and everyone else's to a shareable per-track delta
        // (trackConfigDeltas) against the admin base. It keys off trackId; in
        // practice the widget is only opened on track configs. A config with no
        // trackId (assembly/connection) degrades gracefully: updateTrackConfiguration
        // finds no base/session/connection home and the edit just applies to the
        // live MST node in memory for this session.
        //
        // BaseTrackModel's afterAttach runs a sibling debounced save (a reaction
        // on the same config node) for direct setSlot quick-edits on a *shown*
        // track. Both intentionally coexist: this widget also handles an unshown
        // track edited from the selector, which has no BaseTrackModel. When both
        // fire they compute an identical delta, deduped in updateTrackConfiguration
        // — don't drop one to "simplify".
        addDisposer(
          self,
          autorun(() => {
            if (self.target) {
              // track configs (the practical case) carry a trackId; a
              // trackId-less snapshot degrades to an in-memory edit (see above)
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
