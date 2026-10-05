import { getSession } from '@jbrowse/core/util'
import { getEditableTrackConfigById } from '@jbrowse/core/util/types'
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
      /**
       * #property
       * the track whose working copy this edits, re-resolved on every read so
       * an undo that replaces the copy moves the editor with it
       */
      trackId: types.maybe(types.string),
    })
    .volatile(() => ({
      // a config the session cannot resolve by trackId: an assembly, a
      // connection, or a track a view holds inline
      inlineTarget: undefined as AnyConfigurationModel | undefined,
      // displayId of the display active in the view this editor was opened
      // from; its config accordion expands by default while the track's other
      // (incompatible/inactive) displays start collapsed
      expandedDisplayId: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get target(): AnyConfigurationModel | undefined {
        return self.trackId === undefined
          ? self.inlineTarget
          : getEditableTrackConfigById(getSession(self), self.trackId)
      },
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
        /**
         * #action
         * edit the working copy of `trackId`, saving any edit still pending
         * on the previous target first
         */
        setTrackId(trackId: string) {
          save()
          self.inlineTarget = undefined
          self.trackId = trackId
        },
        /**
         * #action
         * edit a config node directly, saving any edit still pending on the
         * previous target first
         */
        setTarget(newTarget: AnyConfigurationModel | undefined) {
          save()
          self.trackId = undefined
          self.inlineTarget = newTarget
        },
        setExpandedDisplayId(displayId: string | undefined) {
          self.expandedDisplayId = displayId
        },
        afterCreate() {
          // Saves through updateTrackConfiguration as a per-track delta. A
          // config with no trackId (assembly/connection) finds no home there,
          // so the edit stays on the live MST node for this session.
          //
          // BaseTrackModel runs a sibling saver on a shown track's working
          // copy, which this widget edits too; this one covers a track that is
          // not shown. When both fire they compute an identical delta, deduped
          // in updateTrackConfiguration.
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
