import { expandLooseTrackConfig } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, computed } from 'mobx'

import { BaseSessionModel, isBaseSession } from './BaseSession.ts'
import { isSessionWithConnections } from './Connections.ts'
import { ReferenceManagementSessionMixin } from './ReferenceManagement.ts'
import { assertNotReaddedDifferently } from './readdedTrackConf.ts'
import { assertTrackConfOutlivesItsAssemblies } from './temporaryAssemblyTracks.ts'

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
       * Each track's base by trackId: the entry its edits diff against. Here
       * the config.json entry, which an edit writes directly.
       */
      get trackBasesById(): Map<string, AnyConfigurationModel> {
        const tracks: AnyConfigurationModel[] = self.jbrowse.tracks
        return new Map(tracks.map(t => [t.trackId, t]))
      },
      /**
       * #method
       * A track's base as the session resolves it, its edits applied. Here the
       * base itself.
       */
      withTrackEdits(base: AnyConfigurationModel): AnyConfigurationModel {
        return base
      },
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return self.jbrowse.tracks
      },
    }))
    .extend(self => {
      // Assembly sequences and connection tracks by trackId, which win over a
      // track base of the same id.
      const otherConfigsById = computed<Record<string, AnyConfigurationModel>>(
        () => {
          const temporaryAssemblies =
            'temporaryAssemblies' in self
              ? (self.temporaryAssemblies as {
                  sequence: { trackId: string }
                }[])
              : []

          // both come from the connections mixin, which not every session
          // composes. connectionInstances is annotated because its element type
          // is a runtime-pluggable stateModel, so the guard can't infer it.
          const connectionInstances: ConnectionInstance[] =
            isSessionWithConnections(self) ? self.connectionInstances : []

          const connectionTrackConfigs = isSessionWithConnections(self)
            ? self.connectionTrackConfigs
            : {}

          return Object.fromEntries([
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
        { name: 'otherConfigsById' },
      )
      const tracksByIdRecord = computed(
        () =>
          Object.fromEntries([
            ...self.tracks.map(t => [t.trackId, t]),
            ...Object.entries(otherConfigsById.get()),
          ]) as Record<string, AnyConfigurationModel>,
        { name: 'tracksByIdRecord' },
      )
      // Per-id computeds backing getTrackById. An edit re-resolves each
      // observed id in constant time, and an unedited id resolves to the same
      // object, so its observers never wake. Not evicted: bounded by the
      // distinct ids resolved this session.
      const trackByIdComputeds = new Map<
        string,
        IComputedValue<AnyConfigurationModel | undefined>
      >()
      return {
        views: {
          /**
           * #method
           * Config for one trackId — a track, assembly sequence, or connection
           * track — or undefined. Per-id reactive: every display resolves its
           * config through this (via TrackConfigurationReference) and
           * subscribes only to its own id, so one track's settings edit doesn't
           * re-render the others.
           */
          getTrackById(id: string): AnyConfigurationModel | undefined {
            let c = trackByIdComputeds.get(id)
            if (!c) {
              c = computed(() => {
                const other = otherConfigsById.get()[id]
                if (other) {
                  return other
                }
                const base = self.trackBasesById.get(id)
                return base && self.withTrackEdits(base)
              })
              trackByIdComputeds.set(id, c)
            }
            return c.get()
          },
          /**
           * #method
           * Every track config the session can resolve, keyed by trackId.
           * Prefer the per-id reactive `getTrackById(id)`: this map is rebuilt
           * over every track on any edit, and reading it subscribes the caller
           * to all of them. Kept for plugins that look up ids in a
           * non-reactive context.
           *
           * @deprecated
           */
          getTracksById(): Record<string, AnyConfigurationModel> {
            return tracksByIdRecord.get()
          },
        },
        actions: {
          // Holds the indexes getTrackById reads, so a reader outside any
          // reaction (ranking search hits: 33ms per search unheld on a
          // 2000-track config, 0.07ms held) gets the cache too. Not
          // `keepAlive`: that subscription never ends, and it reaches
          // jbrowse.tracks on the root, so it pinned every superseded session
          // for the tab's life.
          afterAttach() {
            addDisposer(
              self,
              autorun(
                () => {
                  void self.trackBasesById
                  otherConfigsById.get()
                },
                { name: 'trackIndex' },
              ),
            )
          },
        },
      }
    })
    .actions(self => {
      function addToSession(trackConf: AnyConfiguration) {
        assertTrackConfOutlivesItsAssemblies(self, trackConf, 'jbrowse.tracks')
        const expanded = expandLooseTrackConfig(trackConf, pluginManager)
        const { trackId, type } = expanded as { trackId: string; type: string }
        const existing = self.getTrackById(trackId)
        if (existing) {
          assertNotReaddedDifferently(pluginManager, existing, {
            ...expanded,
            trackId,
            type,
          })
          return existing
        }
        return self.jbrowse.addTrackConf(trackConf)
      }
      return {
        /**
         * #action
         * Add a track config to *this session*.
         *
         * This mixin's session has no separate session-track store, so the
         * destination is the jbrowse config — which in the products that compose
         * it (desktop) is the single user's own file rather than something a
         * server hands other visitors, so the two scopes are the same place.
         * Defined here anyway so that every session has it: a feature standing a
         * track up on the user's behalf can then call one action everywhere
         * instead of asking which mixin it landed on.
         * `SessionTracksManagerSessionMixin` overrides it with the real
         * session-scoped store.
         */
        addSessionTrackConf(trackConf: AnyConfiguration) {
          return addToSession(trackConf)
        },

        /**
         * #action
         * Add a track config wherever *this user's* catalog edits belong — the
         * "Add track" workflows, where an admin adding a track means to add it
         * for the whole site. `SessionTracksManagerSessionMixin` overrides it to
         * send a non-admin's to the session instead; here there is only the one
         * destination.
         *
         * Anything that is not an Add-track workflow wants
         * `addSessionTrackConf`: a track a feature stands up on the user's behalf
         * — a search result, a computed consensus, a reconstruction's labels — is
         * not a catalog entry, and publishing one writes it into the config.json
         * every visitor is served, once per click.
         */
        publishTrackConf(trackConf: AnyConfiguration) {
          assertTrackConfOutlivesItsAssemblies(
            self,
            trackConf,
            'jbrowse.tracks',
          )
          return self.jbrowse.addTrackConf(trackConf)
        },

        /**
         * #action
         * Deprecated alias of `addSessionTrackConf`. Call that, or
         * `publishTrackConf`, which say which destination they mean.
         *
         * @deprecated
         *
         * Kept because a prebuilt plugin bundle reaches this by name at runtime
         * and cannot be recompiled — `jbrowse-plugin-protein3d` calls it, and a
         * member lookup that stops resolving throws nothing at all
         * (`pluginFacingSessionApi.test.ts` is the guard). It now means the
         * session, which is the destination every such caller wanted: a track a
         * plugin stands up for one user is not a catalog entry. Nothing in tree
         * may call it — `no-restricted-syntax` says so.
         */
        addTrackConf(trackConf: AnyConfiguration) {
          return addToSession(trackConf)
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
      }
    })
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
