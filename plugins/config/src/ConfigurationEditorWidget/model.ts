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
    .actions(self => {
      type TrackSnapshot = { trackId: string; [key: string]: unknown }
      let timeout: ReturnType<typeof setTimeout> | undefined
      let unsaved: TrackSnapshot | undefined
      function save() {
        clearTimeout(timeout)
        if (unsaved) {
          const session = getSession(self) as SessionWithConfigEditing
          session.updateTrackConfiguration(unsaved)
          unsaved = undefined
        }
      }
      return {
        setTarget(newTarget: AnyConfigurationModel | undefined) {
          self.target = newTarget
        },
        setExpandedDisplayId(displayId: string | undefined) {
          self.expandedDisplayId = displayId
        },
        afterCreate() {
          // Auto-save configuration changes with 400ms debounce, through
          // updateTrackConfiguration, which routes admin edits to the jbrowse
          // config in place and everyone else's to a shareable per-track delta
          // (trackConfigDeltas) against the admin base. A config with no
          // trackId (assembly/connection) finds no home there, so the edit
          // stays on the live MST node for this session.
          //
          // BaseTrackModel's afterAttach runs a sibling debounced save for
          // direct setSlot quick-edits on a *shown* track. Both intentionally
          // coexist: this widget also handles an unshown track edited from the
          // selector, which has no BaseTrackModel. When both fire they compute
          // an identical delta, deduped in updateTrackConfiguration — don't
          // drop one to "simplify".
          addDisposer(
            self,
            autorun(() => {
              if (self.target) {
                unsaved = getSnapshot(self.target) as TrackSnapshot
                clearTimeout(timeout)
                timeout = setTimeout(save, 400)
              }
            }),
          )
          addDisposer(self, () => {
            clearTimeout(timeout)
          })
        },
        // closing the editor detaches it from the session, so an edit still
        // inside the debounce saves now, while getSession(self) resolves
        beforeDetach() {
          save()
        },
      }
    })
}
