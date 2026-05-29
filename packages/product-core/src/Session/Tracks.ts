import { types } from '@jbrowse/mobx-state-tree'

import { BaseSessionModel, isBaseSession } from './BaseSession.ts'
import { ReferenceManagementSessionMixin } from './ReferenceManagement.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel TracksManagerSessionMixin
 * composed of
 * - BaseSessionModel
 * - ReferenceManagementSessionMixin
 */
export function TracksManagerSessionMixin(pluginManager: PluginManager) {
  return types
    .compose(
      'TracksManagerSessionMixin',
      BaseSessionModel(pluginManager),
      ReferenceManagementSessionMixin(pluginManager),
    )
    .views(self => ({
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return self.jbrowse.tracks
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Map of trackId → config for all tracks, assemblies, and connections.
       * Frozen jbrowse.tracks are returned as plain objects here; hydration to
       * MST models happens lazily in TrackConfigurationReference on first access.
       * MobX caches this until any dependency changes.
       */
      // method rather than getter so subclasses can override it
      getTracksById(): Record<string, AnyConfigurationModel> {
        const temporaryAssemblies =
          'temporaryAssemblies' in self
            ? (self.temporaryAssemblies as { sequence: { trackId: string } }[])
            : []

        const connectionInstances =
          'connectionInstances' in self
            ? (self.connectionInstances as {
                tracks: AnyConfigurationModel[]
              }[])
            : []

        return Object.fromEntries([
          ...self.tracks.map(t => [t.trackId, t]),
          // Include assembly sequence tracks so they can be resolved by trackId
          ...self.assemblies.map(a => [a.sequence.trackId, a.sequence]),
          // Include temporary assembly sequence tracks
          ...temporaryAssemblies.map(a => [a.sequence.trackId, a.sequence]),
          ...connectionInstances.flatMap(c =>
            c.tracks.map(t => [t.trackId, t]),
          ),
        ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * MobX-cached map of trackId → config for all tracks, assemblies, and
       * connections. Recomputes only when dependencies change.
       */
      get tracksById(): Record<string, AnyConfigurationModel> {
        return self.getTracksById()
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
        const callbacksToDereferenceTrack: (() => void)[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const referring = self.getReferring(trackConf)
        self.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        for (const cb of callbacksToDereferenceTrack) {
          cb()
        }
        if (self.adminMode) {
          return self.jbrowse.deleteTrackConf(trackConf)
        }
      },
    }))
}

/** Session mixin MST type for a session that has tracks */
export type SessionWithTracksType = ReturnType<typeof TracksManagerSessionMixin>

/** Instance of a session that has tracks */
export type SessionWithTracks = Instance<SessionWithTracksType>

/** Type guard for SessionWithTracks */
export function isSessionWithTracks(
  thing: IAnyStateTreeNode,
): thing is SessionWithTracks {
  return isBaseSession(thing) && 'tracks' in thing
}
