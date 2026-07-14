import { types } from '@jbrowse/mobx-state-tree'
import { computed } from 'mobx'

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
import type { IComputedValue } from 'mobx'

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
    .views(self => {
      // One index trackId → config for all tracks, assembly sequences, and
      // connection tracks. Frozen jbrowse.tracks entries stay plain objects
      // here; hydration to MST nodes happens lazily in TrackConfigurationReference
      // on first access. Cached, so the N per-id lookups below share one rebuild
      // per change rather than each re-scanning.
      const tracksByIdRecord = computed<Record<string, AnyConfigurationModel>>(
        () => {
          const temporaryAssemblies =
            'temporaryAssemblies' in self
              ? (self.temporaryAssemblies as {
                  sequence: { trackId: string }
                }[])
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
            // assembly sequence tracks, so they resolve by trackId
            ...self.assemblies.map(a => [a.sequence.trackId, a.sequence]),
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
      )
      // Per-id computed cache backing getTrackById. Resolving one track's config
      // subscribes only to that id's computed, so editing track A leaves track
      // B's observers untouched: an unedited id's entry keeps its object identity
      // across a sibling edit, so its computed re-evaluates equal and MobX
      // short-circuits — B never wakes. Derived on read (no reconcile autorun),
      // so it is never stale mid-action: session hydration and add-and-show
      // resolve straight through it. Not evicted — bounded by the distinct ids
      // resolved this session, and holds no authoritative state.
      const trackByIdComputeds = new Map<
        string,
        IComputedValue<AnyConfigurationModel | undefined>
      >()
      return {
        /**
         * #method
         * Config for one trackId — a track, assembly sequence, or connection
         * track — or undefined. Per-id reactive: every display resolves its
         * config through this (via TrackConfigurationReference) and subscribes
         * only to its own id, so one track's settings edit doesn't re-render the
         * others.
         */
        getTrackById(id: string): AnyConfigurationModel | undefined {
          let c = trackByIdComputeds.get(id)
          if (!c) {
            c = computed(() => tracksByIdRecord.get()[id])
            trackByIdComputeds.set(id, c)
          }
          return c.get()
        },
        /**
         * #method
         * @deprecated prefer the per-id reactive `getTrackById(id)`. Reading this
         * whole map subscribes the caller to *every* track, so an edit to any one
         * track wakes it — the reason internal display config resolution moved off
         * it. Kept for backwards compatibility with plugins that look up ids in a
         * non-reactive context.
         */
        getTracksById(): Record<string, AnyConfigurationModel> {
          return tracksByIdRecord.get()
        },
      }
    })
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
