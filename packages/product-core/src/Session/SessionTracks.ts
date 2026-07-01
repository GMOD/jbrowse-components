import { diffTrackConfig, mergeTrackConfig } from '@jbrowse/core/util'
import {
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'

import { isBaseSession } from './BaseSession.ts'
import { TracksManagerSessionMixin } from './Tracks.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

export interface PlainTrackConfig {
  trackId: string
  [key: string]: unknown
}

// diffTrackConfig/mergeTrackConfig operate on plain config snapshots. This
// mixin is composed over two jbrowse config models: app-core's (web/desktop),
// whose `tracks` is a types.frozen array of plain objects, and product-core's
// (embedded react views), whose `tracks` is a types.array of MST config nodes.
// Normalize the base to a plain snapshot so the delta math is correct for both;
// a plain object passes through untouched.
function toPlainConfig(base: PlainTrackConfig): PlainTrackConfig {
  const node = base as unknown
  return isStateTreeNode(node) ? (getSnapshot(node) as PlainTrackConfig) : base
}

// diffTrackConfig always retains a self-identifying trackId, so a delta whose
// only key is trackId records no changed slots: the edited config matches the
// base. Such a delta must not be stored — it would flip isTrackOverride (edited
// badge + Reset menu) on with nothing actually overridden.
function deltaHasChanges(delta: PlainTrackConfig): boolean {
  return Object.keys(delta).length > 1
}

function withoutDelta(
  deltas: Record<string, PlainTrackConfig>,
  trackId: string,
): Record<string, PlainTrackConfig> {
  const { [trackId]: _dropped, ...rest } = deltas
  return rest
}

/**
 * #stateModel SessionTracksManagerSessionMixin
 */
export function SessionTracksManagerSessionMixin(pluginManager: PluginManager) {
  return TracksManagerSessionMixin(pluginManager)
    .named('SessionTracksManagerSessionMixin')
    .props({
      /**
       * #property
       * User-added session tracks (no matching admin config track). A non-admin's
       * *edits* to an existing config track are stored as deltas
       * (trackConfigDeltas), not here.
       */
      sessionTracks: types.stripDefault(
        types.array(pluginManager.pluggableConfigSchemaType('track')),
        [],
      ),
      /**
       * #property
       * Per-track config overrides for a non-admin, keyed by trackId, stored as a
       * *delta* against the admin-owned base config (jbrowse.tracks entry) rather
       * than a full copy — so a later admin change to an untouched field still
       * flows through (see trackConfigDelta.ts). Frozen (not a typed track array)
       * on purpose: a typed create() would fill defaults, erasing the "unset vs
       * default" distinction the delta merge relies on.
       */
      trackConfigDeltas: types.frozen<Record<string, PlainTrackConfig>>({}),
    })
    .views(self => {
      // Memoize merged configs per (base object, delta value) pair so the tracks
      // getter returns stable object identity across unrelated recomputes. A
      // fresh merged object each time would rehydrate a new MST node in
      // TrackConfigurationReference, losing open display state (see CLAUDE.md).
      // Both keys have stable identity until they actually change: a track's
      // delta only when that track is edited, and the base only on a
      // jbrowse.tracks write. This relies on a base config never mutating in
      // place: app-core's frozen array replaces the entry (new identity) on
      // updateTrackConf, and product-core's MST-node bases have no edit path at
      // all (no updateTrackConf; embedded sessions are adminMode:false). If an
      // in-place base edit is ever added, key this cache on base content too.
      const mergeCache = new WeakMap<
        object,
        { delta: PlainTrackConfig; merged: AnyConfigurationModel }
      >()
      return {
        /**
         * #getter
         * User-added session tracks first, then each admin config track with its
         * delta (trackConfigDeltas) merged over it. A base track without a delta
         * is returned unchanged by identity to keep the hydration cache warm.
         */
        get tracks(): AnyConfigurationModel[] {
          const deltas = self.trackConfigDeltas
          const sessionIds = new Set(self.sessionTracks.map(t => t.trackId))
          const configTracks = self.jbrowse.tracks as PlainTrackConfig[]
          const merged = configTracks
            .filter(t => !sessionIds.has(t.trackId))
            .map(base => {
              const delta = deltas[base.trackId]
              if (!delta) {
                return base as unknown as AnyConfigurationModel
              }
              const cached = mergeCache.get(base)
              if (cached?.delta === delta) {
                return cached.merged
              }
              const mergedTrack = mergeTrackConfig(
                toPlainConfig(base),
                delta,
              ) as unknown as AnyConfigurationModel
              mergeCache.set(base, { delta, merged: mergedTrack })
              return mergedTrack
            })
          return [...self.sessionTracks, ...merged]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // One-time format upgrade: a legacy session stored a non-admin's edits as
        // a full-config sessionTracks entry shadowing the same-id admin track.
        // Convert those to deltas so the whole app uses one override mechanism.
        // Genuinely-added session tracks (no matching base) are left in place.
        const configById = new Map(
          (self.jbrowse.tracks as PlainTrackConfig[]).map(t => [t.trackId, t]),
        )
        const legacy = self.sessionTracks.filter(t => configById.has(t.trackId))
        if (legacy.length > 0) {
          const deltas = { ...self.trackConfigDeltas }
          for (const track of legacy) {
            const delta = diffTrackConfig(
              toPlainConfig(configById.get(track.trackId)!),
              getSnapshot(track),
            ) as PlainTrackConfig
            // a legacy override identical to its base contributes no changed
            // slots: drop it rather than migrate a content-free delta
            if (deltaHasChanges(delta)) {
              deltas[track.trackId] = delta
            }
          }
          self.trackConfigDeltas = deltas
          for (const track of legacy) {
            self.sessionTracks.remove(track)
          }
        }
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
            throw new Error(`track type not specified for "${trackId}"`)
          }
          const track = self.sessionTracks.find(t => t.trackId === trackId)
          if (track) {
            return track
          }
          // sessionTracks is a typed MST array (unlike the frozen
          // jbrowse.tracks), so an invalid config throws on push. Surface it as
          // a snackbar and skip the add, rather than letting it crash the app.
          try {
            const length = self.sessionTracks.push(trackConf)
            return self.sessionTracks[length - 1]
          } catch (e) {
            self.notifyError(
              `Track "${trackId}" has an invalid configuration: ${e}`,
              e,
            )
            return undefined
          }
        },

        /**
         * #action
         * Persist an edited track config. Admins edit the jbrowse config in
         * place; everyone else gets a delta (trackConfigDeltas) against the
         * admin-owned base — only the changed slots — so the edits persist and
         * are shared while admin changes to untouched fields still flow through.
         * A user-added session track (no base) keeps living in sessionTracks.
         */
        updateTrackConfiguration(trackConf: PlainTrackConfig) {
          if (self.adminMode) {
            self.jbrowse.updateTrackConf(trackConf)
          } else {
            const { trackId } = trackConf
            const base = (self.jbrowse.tracks as PlainTrackConfig[]).find(
              t => t.trackId === trackId,
            )
            const sessionIdx = self.sessionTracks.findIndex(
              t => t.trackId === trackId,
            )
            if (base) {
              const delta = diffTrackConfig(
                toPlainConfig(base),
                trackConf,
              ) as PlainTrackConfig
              // an edit that nets back to the base carries no changed slots:
              // clear any prior override (implicit reset) instead of pinning a
              // content-free delta; skip a no-op write when there's nothing to
              // clear, so the tracks getter doesn't needlessly churn identity
              if (deltaHasChanges(delta)) {
                self.trackConfigDeltas = {
                  ...self.trackConfigDeltas,
                  [trackId]: delta,
                }
              } else if (trackId in self.trackConfigDeltas) {
                self.trackConfigDeltas = withoutDelta(
                  self.trackConfigDeltas,
                  trackId,
                )
              }
            } else if (sessionIdx !== -1) {
              // a user-added session track (no admin base): edit it in place. A
              // typed MST array throws on an invalid config — snackbar it.
              try {
                self.sessionTracks[sessionIdx] = trackConf
              } catch (e) {
                self.notifyError(
                  `Track "${trackId}" has an invalid configuration: ${e}`,
                  e,
                )
              }
            }
            // else: a track with neither an admin base nor a sessionTracks entry
            // (e.g. a connection-provided track). There's no base to diff against
            // and it isn't a user-added track, so no delta is persisted; the edit
            // still applies in-memory to the resolved config for this session.
          }
        },

        /**
         * #action
         * Drop a non-admin's delta (trackConfigDeltas) so the track reverts to
         * its admin config (jbrowse.tracks) default. Unlike deleteTrackConf this
         * does not dereference the track from open views — the base config
         * re-resolves in place, so an open track stays open and simply reverts.
         */
        resetTrackConfiguration(trackId: string) {
          if (trackId in self.trackConfigDeltas) {
            self.trackConfigDeltas = withoutDelta(self.trackConfigDeltas, trackId)
          }
        },

        /**
         * #action
         */
        deleteTrackConf(trackConf: AnyConfigurationModel) {
          superDeleteTrackConf(trackConf)
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
