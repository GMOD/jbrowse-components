import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import { BaseSessionModel, isBaseSession } from './BaseSession.ts'
import { isSessionWithConnections } from './Connections.ts'
import { ReferenceManagementSessionMixin } from './ReferenceManagement.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { ConnectionInstance } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

/**
 * #stateModel TracksManagerSessionMixin
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
    .volatile(() => ({
      // Stable trackId → config map, reconciled in place from getTracksById()
      // (see the reconcile autorun). Held as one persistent ObservableMap rather
      // than rebuilt per change so a config edit only notifies the *edited*
      // track's entry: unchanged tracks keep their identity, so re-`set`ting
      // them is a no-op. Every display resolves its config through
      // TrackConfigurationReference, which reads `tracksById.get(id)` on every
      // access — a wholesale-recomputed map made each such read depend on every
      // track, so one track's edit re-rendered all of them.
      //
      // `deep: false` stores each config by reference: the default deep enhancer
      // would wrap every plain frozen config in a fresh observable, breaking the
      // identity the hydration cache keys on (and re-`set`ting an unchanged entry
      // would then always notify).
      tracksByIdMap: observable.map<string, AnyConfigurationModel>(undefined, {
        deep: false,
      }),
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
            ? (self.connectionInstances as ConnectionInstance[])
            : []

        const connectionTrackConfigs =
          'connectionTrackConfigs' in self
            ? (self.connectionTrackConfigs as Record<
                string,
                { config: AnyConfigurationModel }
              >)
            : {}

        return Object.fromEntries([
          ...self.tracks.map(t => [t.trackId, t]),
          // Include assembly sequence tracks so they can be resolved by trackId
          ...self.assemblies.map(a => [a.sequence.trackId, a.sequence]),
          // Include temporary assembly sequence tracks
          ...temporaryAssemblies.map(a => [a.sequence.trackId, a.sequence]),
          ...connectionInstances.flatMap(c =>
            c.tracks.map(t => [t.trackId, t]),
          ),
          // Persisted configs of opened connection tracks. Placed last so they
          // win over the live connection instance: identity-stable across
          // reload, and resolves even when the connection isn't re-established.
          ...Object.entries(connectionTrackConfigs).map(([trackId, e]) => [
            trackId,
            e.config,
          ]),
        ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Stable, per-entry-observable map of trackId → config for all tracks,
       * assemblies, and connections. Reading `.get(id)` subscribes only to that
       * entry, so editing one track no longer invalidates every consumer (see
       * `tracksByIdMap`). Kept current by the reconcile autorun below.
       */
      get tracksById(): ObservableMap<string, AnyConfigurationModel> {
        return self.tracksByIdMap
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Reconcile `tracksByIdMap` to the given trackId → config snapshot: set
       * new/changed entries, drop removed ones. Mutation only — the tracked read
       * of `getTracksById()` happens in the driving autorun, NOT here, because a
       * MobX action untracks its reads (so reading the sources here would leave
       * the autorun with no dependencies and it would never re-fire). `set` on an
       * unchanged (identity-equal) entry doesn't notify, so only genuinely-changed
       * tracks wake their observers.
       */
      applyTracksById(desired: Record<string, AnyConfigurationModel>) {
        const map = self.tracksByIdMap
        // collect stale keys in a read-only pass, then delete — mutating the map
        // mid-iteration over its own keys would be unsafe
        const stale: string[] = []
        for (const key of map.keys()) {
          if (!(key in desired)) {
            stale.push(key)
          }
        }
        for (const key of stale) {
          map.delete(key)
        }
        for (const [key, value] of Object.entries(desired)) {
          map.set(key, value)
        }
      },
    }))
    .actions(self => ({
      // afterAttach, not afterCreate: getTracksById reads `self.jbrowse`
      // (= getParent(self).jbrowse), which throws while the session is still a
      // detached root during creation. By attach time the session is under the
      // root, so getParent resolves. The read stays in the autorun (not the
      // action) so its observables are tracked and the map stays current.
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            self.applyTracksById(self.getTracksById())
          }),
        )
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
       * Persist edited track config back to the in-memory jbrowse config. The
       * session-tracks mixin overrides this so a non-admin's edits become a
       * shareable session-track override instead.
       */
      updateTrackConfiguration(trackConf: {
        trackId: string
        [key: string]: unknown
      }) {
        // an opened connection track lives in connectionTrackConfigs, not
        // jbrowse.tracks; persist its edit there (jbrowse.updateTrackConf would
        // no-op, since the track isn't in the config). Desktop uses this base
        // mixin, so without this branch a connection-track edit is lost on
        // reload.
        if (
          isSessionWithConnections(self) &&
          trackConf.trackId in self.connectionTrackConfigs
        ) {
          self.updateConnectionTrackConfig(trackConf)
        } else {
          self.jbrowse.updateTrackConf(trackConf)
        }
      },

      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const { trackId } = trackConf
        self.dereferenceTrack(trackId, self.getReferring(trackId))
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
