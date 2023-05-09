import { IAnyStateTreeNode, Instance, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import BaseSession, { isBaseSession } from './Base'
import ReferenceManagement from './ReferenceManagement'

/**
 * #stateModel TracksManagerSessionMixin
 * composed of
 * - BaseSessionModel
 * - ReferenceManagementSessionMixin
 */
export default function Tracks(pluginManager: PluginManager) {
  return types
    .compose(
      'TracksManagerSessionMixin',
      BaseSession(pluginManager),
      ReferenceManagement(pluginManager),
    )
    .views(self => ({
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return self.jbrowse.tracks
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addTrackConf(trackConf: AnyConfiguration) {
        return self.jbrowse.addTrackConf(trackConf)
      },

      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const referring = self.getReferring(trackConf)
        self.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        callbacksToDereferenceTrack.forEach(cb => cb())
        if (self.adminMode) {
          return self.jbrowse.deleteTrackConf(trackConf)
        }
      },
    }))
}

/** Session mixin MST type for a session that has tracks */
export type SessionWithTracksType = ReturnType<typeof Tracks>

/** Instance of a session that has tracks */
export type SessionWithTracks = Instance<SessionWithTracksType>

/** Type guard for SessionWithTracks */
export function isSessionWithTracks(
  thing: IAnyStateTreeNode,
): thing is SessionWithTracks {
  return isBaseSession(thing) && 'tracks' in thing
}
