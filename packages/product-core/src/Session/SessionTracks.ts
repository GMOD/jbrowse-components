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
       */
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...self.jbrowse.tracks]
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
