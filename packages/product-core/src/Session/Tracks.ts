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
       * #method
       * An assembly's sequence track as the session resolves it, its edits
       * applied. Here the assembly's live node, which an edit writes directly.
       */
      withSequenceEdits(sequence: AnyTrackConfig): AnyTrackConfig {
        return sequence
      },
      /**
       * #getter
       */
      get tracks(): TrackConfigEntry[] {
        return self.jbrowse.tracks
      },
    }))
    .extend(self => {
      // Assembly sequences by trackId, which win over a track base of the same
      // id
      const sequencesById = computed<Record<string, AnyTrackConfig>>(
        () => {
          const temporaryAssemblies =
            'temporaryAssemblies' in self
              ? (self.temporaryAssemblies as {
                  sequence: { trackId: string }
                }[])
              : []
          return Object.fromEntries([
            ...self.assemblies.map(a => [a.sequence.trackId, a.sequence]),
            ...temporaryAssemblies.map(a => [a.sequence.trackId, a.sequence]),
          ])
        },
        { name: 'sequencesById' },
      )
      // Each hub track's base by trackId: the copy kept of an opened one, else
      // the live connection's entry
      const connectionBasesById = computed<Map<string, TrackConfigEntry>>(
        () => {
          // both come from the connections mixin, which not every session
          // composes. connectionInstances is annotated because its element type
          // is a runtime-pluggable stateModel, so the guard can't infer it.
          const connectionInstances: ConnectionInstance[] =
            isSessionWithConnections(self) ? self.connectionInstances : []
          const connectionTrackConfigs = isSessionWithConnections(self)
            ? self.connectionTrackConfigs
            : {}
          return new Map([
            ...connectionInstances.flatMap(c =>
              c.tracks.map(t => [t.trackId, t] as const),
            ),
            ...Object.entries(connectionTrackConfigs).map(
              ([trackId, e]) => [trackId, e.config] as const,
            ),
          ])
        },
        { name: 'connectionBasesById' },
      )
      // A session or config track wins over a hub track of the same id
      function trackBaseById(id: string): TrackConfigEntry | undefined {
        return self.trackBasesById.get(id) ?? connectionBasesById.get().get(id)
      }
      const sequencesWithEdits = computed<Record<string, AnyTrackConfig>>(
        () =>
          Object.fromEntries(
            Object.entries(sequencesById.get()).map(([trackId, sequence]) => [
              trackId,
              self.withSequenceEdits(sequence),
            ]),
          ),
        { name: 'sequencesWithEdits' },
      )
      // Kept against the lists it was built from rather than held, since
      // holding it would rebuild it on every edit
      let tracksById:
        | {
            tracks: TrackConfigEntry[]
            sequences: Record<string, AnyTrackConfig>
            connectionBases: Map<string, TrackConfigEntry>
            record: Record<string, AnyTrackConfig>
          }
        | undefined
      function exactTrackById(id: string) {
        const sequence = sequencesById.get()[id]
        const base = trackBaseById(id)
        return sequence
          ? self.withSequenceEdits(sequence)
          : base && self.withTrackEdits(base)
      }
      // Each track's `aliases`, mapped to its trackId
      const trackIdsByAlias = computed(
        () => {
          const byAlias = new Map<string, string>()
          for (const track of self.trackBasesById.values()) {
            for (const alias of track.aliases ?? []) {
              byAlias.set(alias, track.trackId)
            }
          }
          return byAlias
        },
        { name: 'trackIdsByAlias' },
      )
      // Reads the id indexes only, which no settings edit rebuilds
      function canonicalTrackId(id: string) {
        return id in sequencesById.get() || trackBaseById(id)
          ? id
          : (trackIdsByAlias.get().get(id) ?? id)
      }
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
           * The trackId `id` names: itself when a track, assembly sequence or
           * connection track has it, else the track listing it in `aliases`,
           * else `id` unchanged. Compare or key an id from a session, link,
           * search index or caller by this.
           */
          canonicalTrackId,
          /**
           * #method
           * Config for one trackId — a track, assembly sequence, or connection
           * track — or undefined. Per-id reactive: every display resolves its
           * config through this (via TrackConfigurationReference) and
           * subscribes only to that track's id, so one track's settings edit doesn't
           * re-render the others. An alias resolves to its track, which
           * carries its current trackId.
           */
          getTrackById(id: string): AnyTrackConfig | undefined {
            let c = trackByIdComputeds.get(id)
            if (!c) {
              c = computed(() => exactTrackById(canonicalTrackId(id)))
              trackByIdComputeds.set(id, c)
            }
            return c.get()
          },
          /**
           * #method
           * The assembly's own sequence track config under `id`, before any
           * edit, or undefined.
           */
          assemblySequenceById(id: string): AnyTrackConfig | undefined {
            return sequencesById.get()[id]
          },
          /**
           * #method
           * The entry `id`'s edits diff against: its `trackBasesById` entry,
           * else its connection's entry, which is the copy kept when the track
           * was opened or else the live hub's.
           */
          trackBaseById,
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
            const sequences = sequencesWithEdits.get()
            const connectionBases = connectionBasesById.get()
            if (
              tracksById?.tracks !== tracks ||
              tracksById.sequences !== sequences ||
              tracksById.connectionBases !== connectionBases
            ) {
              tracksById = {
                tracks,
                sequences,
                connectionBases,
                record: Object.fromEntries([
                  ...[...connectionBases.values()].map(t => [
                    t.trackId,
                    self.withTrackEdits(t),
                  ]),
                  ...tracks.map(t => [t.trackId, t]),
                  ...Object.entries(sequences),
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
                  sequencesWithEdits.get()
                  connectionBasesById.get()
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
        editableConfig(self).updateTrackConf(trackConf)
      },

      /**
       * #action
       */
      deleteTrackConf(trackConf: { trackId: string }) {
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
