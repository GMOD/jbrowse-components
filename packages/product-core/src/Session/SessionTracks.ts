import { types } from 'mobx-state-tree'

import { isBaseSession } from './BaseSession'
import { TracksManagerSessionMixin } from './Tracks'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'

// locals
import type { IAnyStateTreeNode, Instance } from 'mobx-state-tree'

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
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
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
            throw new Error(`unknown track type ${type}`)
          }
          const track = self.sessionTracks.find(t => t.trackId === trackId)
          if (track) {
            return track
          }
          const length = self.sessionTracks.push(trackConf)
          return self.sessionTracks[length - 1]
        },

        /**
         * #action
         */
        deleteTrackConf(trackConf: AnyConfigurationModel) {
          // try to delete it in the main config if in admin mode
          const found = superDeleteTrackConf(trackConf)
          if (found) {
            return found
          }
          // if not found or not in admin mode, try to delete it in the
          // sessionTracks
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
