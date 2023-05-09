import { IAnyStateTreeNode, Instance, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import Tracks from './Tracks'
import { isBaseSession } from './Base'

/**
 * #stateModel SessionTracksManagerSessionMixin
 */
export default function SessionTracks(pluginManager: PluginManager) {
  return Tracks(pluginManager)
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
        return self.jbrowse.tracks
      },
    }))
    .actions(self => {
      const super_addTrackConf = self.addTrackConf
      const super_deletetrackConf = self.deleteTrackConf
      return {
        /**
         * #action
         */
        addTrackConf(trackConf: AnyConfiguration) {
          if (self.adminMode) {
            return super_addTrackConf(trackConf)
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
          const found = super_deletetrackConf(trackConf)
          if (found) {
            return found
          }
          // if not found or not in admin mode, try to delete it in the sessionTracks
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
export type SessionWithSessionTracksType = ReturnType<typeof SessionTracks>

/** Instance of a session that has `sessionTracks` */
export type SessionWithSessionTracks = Instance<SessionWithSessionTracksType>

/** Type guard for SessionWithSessionTracks */
export function isSessionWithSessionTracks(
  thing: IAnyStateTreeNode,
): thing is SessionWithSessionTracks {
  return isBaseSession(thing) && 'sessionTracks' in thing
}
