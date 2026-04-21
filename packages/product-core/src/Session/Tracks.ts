import { getEnv, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

import { BaseSessionModel, isBaseSession } from './BaseSession.ts'
import { ReferenceManagementSessionMixin } from './ReferenceManagement.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

// Hydration cache for frozen track configs (jbrowse.tracks is stored as
// types.frozen for large-tracklist performance). Keyed by the frozen object
// itself so the entry is dropped automatically when the frozen ref is
// replaced (e.g. via updateTrackConf), and each trackId maps to the same
// MST instance for the lifetime of its frozen snapshot.
const hydrationCache = new WeakMap<object, AnyConfigurationModel>()

function hydrateTrack(
  t: AnyConfigurationModel | object,
  pluginManager: PluginManager,
  env: unknown,
) {
  if (isStateTreeNode(t)) {
    return t as AnyConfigurationModel
  }
  let inst = hydrationCache.get(t)
  if (!inst) {
    inst = pluginManager
      .pluggableConfigSchemaType('track')
      .create(t, env) as AnyConfigurationModel
    hydrationCache.set(t, inst)
  }
  return inst
}

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

      /**
       * #getter
       * Base assemblies from jbrowse config. Child sessions can override
       * to include additional assemblies (e.g. sessionAssemblies).
       */
      get assemblies(): { sequence: { trackId: string } }[] {
        return self.jbrowse.assemblies
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Map of trackId → config for all tracks, assemblies, and connections.
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

        const env = getEnv(self)
        return Object.fromEntries([
          ...self.tracks.map(t => [
            t.trackId,
            hydrateTrack(t, pluginManager, env),
          ]),
          ...self.assemblies.map(a => [a.sequence.trackId, a.sequence]),
          ...temporaryAssemblies.map(a => [a.sequence.trackId, a.sequence]),
          ...connectionInstances.flatMap(c =>
            c.tracks.map(t => [t.trackId, t]),
          ),
        ])
      },
    }))
    .views(self => ({
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
