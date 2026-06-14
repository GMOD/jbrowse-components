import { types } from '@jbrowse/mobx-state-tree'

import { isBaseSession } from './BaseSession.ts'
import { TracksManagerSessionMixin } from './Tracks.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel SessionTracksManagerSessionMixin
 */
export function SessionTracksManagerSessionMixin(pluginManager: PluginManager) {
  return TracksManagerSessionMixin(pluginManager)
    .named('SessionTracksManagerSessionMixin')
    .props({
      /**
       * #property
       */
      sessionTracks: types.stripDefault(
        types.array(pluginManager.pluggableConfigSchemaType('track')),
        [],
      ),
    })
    .views(self => ({
      /**
       * #getter
       * Session tracks come first and shadow any config (jbrowse.tracks) track
       * with the same trackId, so a non-admin's edits to a config track (stored
       * as a same-id session override, see updateTrackConfiguration) replace the
       * original everywhere it's resolved without showing a duplicate.
       */
      get tracks(): AnyConfigurationModel[] {
        const overridden = new Set(self.sessionTracks.map(t => t.trackId))
        const configTracks = self.jbrowse.tracks as AnyConfigurationModel[]
        return [
          ...self.sessionTracks,
          ...configTracks.filter(t => !overridden.has(t.trackId)),
        ]
      },
    }))
    .actions(self => {
      const {
        addTrackConf: superAddTrackConf,
        deleteTrackConf: superDeleteTrackConf,
      } = self
      return {
        /**
         * #action
         */
        addTrackConf(trackConf: AnyConfiguration) {
          if (self.adminMode) {
            return superAddTrackConf(trackConf)
          }

          const { trackId, type } = trackConf as {
            type: string
            trackId: string
          }
          if (!type) {
            throw new Error(`track type not specified for "${trackId}"`)
          }
          const track = self.sessionTracks.find(t => t.trackId === trackId)
          if (track) {
            return track
          }
          // sessionTracks is a typed MST array (unlike the frozen
          // jbrowse.tracks), so an invalid config throws on push. Surface it as
          // a snackbar and skip the add, rather than letting it crash the app.
          try {
            const length = self.sessionTracks.push(trackConf)
            return self.sessionTracks[length - 1]
          } catch (e) {
            self.notifyError(
              `Track "${trackId}" has an invalid configuration: ${e}`,
              e,
            )
            return undefined
          }
        },

        /**
         * #action
         * Persist edited track config. Admins edit the jbrowse config in place;
         * everyone else gets a session-track override (same trackId) so the
         * edits persist with the session and are shared, instead of being a
         * throwaway in-memory mutation of an admin-owned config track.
         */
        updateTrackConfiguration(trackConf: {
          trackId: string
          [key: string]: unknown
        }) {
          if (self.adminMode) {
            self.jbrowse.updateTrackConf(trackConf)
          } else {
            const { trackId } = trackConf
            const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
            // sessionTracks is a typed MST array, so an invalid config throws on
            // write — surface it as a snackbar rather than crashing the app
            try {
              if (idx === -1) {
                self.sessionTracks.push(trackConf)
              } else {
                self.sessionTracks[idx] = trackConf
              }
            } catch (e) {
              self.notifyError(
                `Track "${trackId}" has an invalid configuration: ${e}`,
                e,
              )
            }
          }
        },

        /**
         * #action
         * Drop a session-track override (see updateTrackConfiguration) so the
         * track reverts to its underlying config (jbrowse.tracks) default. Unlike
         * deleteTrackConf this does not dereference the track from open views —
         * the same-trackId config track re-resolves in place, so an open track
         * stays open and simply reverts.
         */
        resetTrackConfiguration(trackId: string) {
          const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
          if (idx !== -1) {
            self.sessionTracks.splice(idx, 1)
          }
        },

        /**
         * #action
         */
        deleteTrackConf(trackConf: AnyConfigurationModel) {
          superDeleteTrackConf(trackConf)
          const { trackId } = trackConf
          const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
          if (idx === -1) {
            return undefined
          }
          return self.sessionTracks.splice(idx, 1)
        },
      }
    })
}

/** Session mixin MST type for a session that has `sessionTracks` */
export type SessionWithSessionTracksType = ReturnType<
  typeof SessionTracksManagerSessionMixin
>

/** Instance of a session that has `sessionTracks` */
export type SessionWithSessionTracks = Instance<SessionWithSessionTracksType>

/** Type guard for SessionWithSessionTracks */
export function isSessionWithSessionTracks(
  thing: IAnyStateTreeNode,
): thing is SessionWithSessionTracks {
  return isBaseSession(thing) && 'sessionTracks' in thing
}
