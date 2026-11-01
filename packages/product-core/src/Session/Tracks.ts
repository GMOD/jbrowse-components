import { editableConfig } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, computed } from 'mobx'

import { BaseSessionModel } from './BaseSession.ts'
import { isSessionWithConnections } from './Connections.ts'
import { ReferenceManagementSessionMixin } from './ReferenceManagement.ts'
import { assertTrackConfOutlivesItsAssemblies } from './temporaryAssemblyTracks.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyTrackConfig,
  TrackConfigEntry,
} from '@jbrowse/core/configuration'
import type { ConnectionInstance } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { IComputedValue } from 'mobx'

/**
 * #stateModel TracksManagerSessionMixin
 * Adds track configs to a session: looking one up by trackId among the
 * config's tracks, assembly sequences and connection tracks, and adding or
 * editing one.
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
      get trackBasesById(): Map<string, TrackConfigEntry> {
        const tracks: TrackConfigEntry[] = self.jbrowse.tracks
        return new Map(tracks.map(t => [t.trackId, t]))
      },
      /**
       * #method
       * A track's base as the session resolves it, its edits applied. Here the
       * base itself.
       */
      withTrackEdits(base: TrackConfigEntry): TrackConfigEntry {
        return base
      },
      /**
       * #getter
       */
      get tracks(): TrackConfigEntry[] {
        return self.jbrowse.tracks
      },
    }))
    .extend(self => {
      // Assembly sequences and connection tracks by trackId, which win over a
      // track base of the same id.
      const otherConfigsById = computed<Record<string, AnyTrackConfig>>(
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
      // Kept against the two lists it was built from rather than held, since
      // holding it would rebuild it on every edit
      let tracksById:
        | {
            tracks: TrackConfigEntry[]
            others: Record<string, AnyTrackConfig>
            record: Record<string, AnyTrackConfig>
          }
        | undefined
      // Per-id computeds backing getTrackById, so an id's readers wake only
      // when it resolves to another config. Not evicted: bounded by the
      // distinct ids resolved this session.
      const trackByIdComputeds = new Map<
        string,
        IComputedValue<AnyTrackConfig | undefined>
      >()
      return {
        views: {
          /**
           * #method
           * Config for one trackId — a track, assembly sequence, or connection
           * track — or undefined. Per-id reactive: every display resolves its
           * config through this (via TrackConfigurationReference) and
           * subscribes only to that track's id, so one track's settings edit doesn't
           * re-render the others.
           */
          getTrackById(id: string): AnyTrackConfig | undefined {
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
           * over every track on the first read after any edit, and reading it
           * subscribes the caller to all of them. Kept for plugins that look
           * up ids in a non-reactive context.
           *
           * @deprecated
           */
          getTracksById(): Record<string, AnyTrackConfig> {
            const { tracks } = self
            const others = otherConfigsById.get()
            if (tracksById?.tracks !== tracks || tracksById.others !== others) {
              tracksById = {
                tracks,
                others,
                record: Object.fromEntries([
                  ...tracks.map(t => [t.trackId, t]),
                  ...Object.entries(others),
                ]),
              }
            }
            return tracksById.record
          },
        },
        actions: {
          // Holds the indexes getTrackById reads and the track list, so a
          // reader outside any reaction (ranking search hits: 33ms per search
          // unheld on a 2000-track config, 0.07ms held; the search box's
          // adapter list) gets the cache too. Not `keepAlive`: that
          // subscription never ends, and it reaches jbrowse.tracks on the
          // root, so it pinned every superseded session for the tab's life.
          afterAttach() {
            addDisposer(
              self,
              autorun(
                () => {
                  void self.tracks
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
    .actions(self => ({
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
        assertTrackConfOutlivesItsAssemblies(self, trackConf, 'jbrowse.tracks')
        return editableConfig(self).addTrackConf(trackConf)
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
        // no-op, since the track isn't in the config). SessionTracks defers a
        // connection track's edit here, so without this branch it is lost on
        // reload.
        if (
          isSessionWithConnections(self) &&
          trackConf.trackId in self.connectionTrackConfigs
        ) {
          self.updateConnectionTrackConfig(trackConf)
        } else {
          editableConfig(self).updateTrackConf(trackConf)
        }
      },

      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyTrackConfig) {
        const { trackId } = trackConf
        self.dereferenceTrack(trackId, self.getReferring(trackId))
        if (self.adminMode) {
          editableConfig(self).deleteTrackConf(trackConf)
        }
      },
    }))
}

/** Session mixin MST type for a session that has tracks */
export type SessionWithTracksType = ReturnType<typeof TracksManagerSessionMixin>

/** Instance of a session that has tracks */
export type SessionWithTracks = Instance<SessionWithTracksType>
