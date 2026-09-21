import { readConfObject } from '@jbrowse/core/configuration'
import {
  diffTrackConfig,
  flattenTrackConfigDelta,
  mergeTrackConfig,
} from '@jbrowse/core/util'
import { expandLooseTrackConfig } from '@jbrowse/core/util/tracks'
import { applySnapshot, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { TracksManagerSessionMixin } from './Tracks.ts'
import { hydratedTrackForm } from './hydratedForms.ts'
import { assertNotReaddedDifferently } from './readdedTrackConf.ts'
import { assertTrackConfOutlivesItsAssemblies } from './temporaryAssemblyTracks.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
} from '@jbrowse/mobx-state-tree'

export interface PlainTrackConfig {
  trackId: string
  [key: string]: unknown
}

// One non-admin working copy, plus the trackConfigDeltas value it mirrors. That
// stamp is the cache key, not trackId — see getEditableTrackConfig.
//
// Exported because it reaches an exported signature, so un-exporting it fails
// TS4058 in three files — and only under `pnpm typecheck`, since jest strips
// types.
export interface EditableTrackConfig {
  node: IAnyStateTreeNode
  delta: PlainTrackConfig | undefined
}

// jbrowse.tracks holds frozen plain objects in every product; single site for
// the cast from its loose frozen type.
function baseTracks(self: {
  jbrowse: { tracks: unknown }
}): PlainTrackConfig[] {
  return self.jbrowse.tracks as PlainTrackConfig[]
}

// Not a key count: every delta keeps its trackId, and one can hold nothing but
// content-free display stubs. A stored delta lights the edited badge, so only a
// changed slot — a reset included — counts.
function deltaHasChanges(
  base: PlainTrackConfig,
  delta: PlainTrackConfig,
): boolean {
  return flattenTrackConfigDelta(base, delta).length > 0
}

// The assemblies a track config names that the config.json does not carry.
// `self.jbrowse.assemblies` is the catalog alone — the session's own
// `assemblies` getter adds sessionAssemblies to it, which is the opposite of
// what this asks.
//
// An assembly's `aliases` are names of that assembly, so a track naming one
// names something the catalog carries and publishes like any other. Matching on
// `name` alone diverted it to the session and told the admin the config.json
// has no such assembly while they were looking at it. Read off the configs
// rather than through the assembly manager: the question is what the config.json
// declares, and the manager also answers for sessionAssemblies, which is the
// case this exists to catch.
function assembliesNotInTheCatalog(
  self: { jbrowse: { assemblies: unknown[] } },
  trackConf: AnyConfiguration,
) {
  const catalog = new Set(
    self.jbrowse.assemblies.flatMap(a => [
      readConfObject(a as AnyConfigurationModel, 'name') as string,
      ...((readConfObject(a as AnyConfigurationModel, 'aliases') as
        | string[]
        | undefined) ?? []),
    ]),
  )
  const names = readConfObject(
    trackConf as AnyConfigurationModel,
    'assemblyNames',
  ) as string[] | undefined
  return names?.filter(name => !catalog.has(name)) ?? []
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
  // A base is the raw config-file object — shorthand `uri`, no display stubs —
  // and a working copy's snapshot is hydrated. Diffing or merging across the
  // two reads every expanded field as an edit, pinning whole adapters into the
  // delta, and every default the admin spelled out as a reset. So a base goes
  // through the same schema first, memoized per frozen-base identity, which is
  // stable until a jbrowse.tracks write.
  const hydrate = hydratedTrackForm(pluginManager)
  const canonicalBaseCache = new WeakMap<object, PlainTrackConfig>()
  function toPlainConfig(base: PlainTrackConfig): PlainTrackConfig {
    const cached = canonicalBaseCache.get(base)
    if (cached) {
      return cached
    }
    const hydrated = hydrate(base)
    canonicalBaseCache.set(base, hydrated)
    return hydrated
  }
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
       * flows through (see trackConfigDelta.ts). A `null` member resets a slot
       * the base sets. Frozen (not a typed track array) on purpose: a typed
       * create() would fill defaults, erasing the "unset vs default"
       * distinction the delta merge relies on.
       *
       * `stripDefault` for the reason every other persisted prop beside it has
       * it: without it the empty map is written into every snapshot and every
       * share link, so a session that never overrode a track still ships
       * `"trackConfigDeltas":{}`. It was the one prop added since that convention
       * without it.
       */
      trackConfigDeltas: types.stripDefault(
        types.frozen<Record<string, PlainTrackConfig>>(),
        {},
      ),
    })
    .volatile(() => ({
      /**
       * Per-track private working copies (non-admin), keyed by trackId. A plain
       * Map — not observable, not persisted — mirroring the pluginManager
       * hydration cache: it holds the live MST config node a shown track's
       * in-place quick-edits mutate, so the shared frozen base is never touched.
       * See
       * [ADR-032](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md).
       *
       * Not evicted: it's a pure memoization cache, bounded by the count of
       * distinct tracks shown this session (each entry a lazily-hydrated config
       * node), holding no authoritative state — the persisted delta is the
       * source of truth, and reset/programmatic edits keep a retained copy in
       * sync. Retention is volatile RAM only (never serialized), so it's not
       * worth a reference-counted prune at every track-removal path.
       *
       * Each entry carries the delta it mirrors, so a delta replaced from
       * outside this mixin invalidates it — see `getEditableTrackConfig`.
       */
      editableTrackConfigs: new Map<string, EditableTrackConfig>(),
    }))
    .views(self => {
      // Memoize merged configs per (base object, delta value) pair so the tracks
      // getter returns stable object identity across unrelated recomputes. A
      // fresh merged object each time would rehydrate a new MST node in
      // TrackConfigurationReference, losing open display state (see CLAUDE.md).
      // Both keys have stable identity until they actually change: a track's
      // delta only when that track is edited, and the base only on a
      // jbrowse.tracks write. This relies on a base config never mutating in
      // place: the frozen array replaces the entry (new identity) on
      // updateTrackConf. If an in-place base edit is ever added, key this cache
      // on base content too.
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
          const configTracks = baseTracks(self)
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
        /**
         * #method
         * The overridden slots for `trackId` (empty when it has no delta): each
         * changed setting's path, its base/default value and the edited value.
         * Drives the "view changes" dialog opened from the edited badge.
         */
        getTrackConfigChanges(trackId: string) {
          // Every rendered track row asks this (the edited badge), but only an
          // edited track has a delta — so scan for the base only once one
          // exists. Skipping it also keeps an unedited row from subscribing to
          // the whole jbrowse.tracks array.
          const delta = self.trackConfigDeltas[trackId]
          const base = delta
            ? baseTracks(self).find(t => t.trackId === trackId)
            : undefined
          return delta && base
            ? flattenTrackConfigDelta(toPlainConfig(base), delta)
            : []
        },
        /**
         * #method
         * A non-admin's private working copy of a track config, created on first
         * access from the current frozen (base+delta) value and cached by
         * trackId, so a shown track's in-place quick-edits (setSlot) mutate this
         * copy and never the shared frozen base node (see ADR-032). Undefined in
         * admin mode — there the base jbrowse.tracks entry is edited in place.
         * Called by TrackConfigurationReference during lazy hydration.
         *
         * Cached against the delta it was built from, not by trackId alone. A
         * delta this mixin wrote re-stamps the entry, so the copy an edit is
         * still being typed into is never swapped out mid-keystroke; a delta
         * replaced from outside — an undo's `applySnapshot` on the session, a
         * session restore — cannot, so the next read rebuilds the copy from the
         * delta that now exists. Reading `trackConfigDeltas` here is also what
         * makes an undo re-resolve the reference at all: the resolver's caller
         * is already subscribed to it through `getTrackById`.
         */
        getEditableTrackConfig(
          trackId: string,
          frozenConfig: unknown,
          schemaType: IAnyType,
        ): IAnyStateTreeNode | undefined {
          if (self.adminMode) {
            return undefined
          }
          const delta = self.trackConfigDeltas[trackId]
          const existing = self.editableTrackConfigs.get(trackId)
          if (existing && existing.delta === delta) {
            return existing.node
          }
          const node = schemaType.create(frozenConfig, {
            pluginManager,
          }) as IAnyStateTreeNode
          self.editableTrackConfigs.set(trackId, { node, delta })
          return node
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // One-time format upgrade: a legacy session stored a non-admin's edits as
        // a full-config sessionTracks entry shadowing the same-id admin track.
        // Convert those to deltas so the whole app uses one override mechanism.
        // Genuinely-added session tracks (no matching base) are left in place.
        const configById = new Map(baseTracks(self).map(t => [t.trackId, t]))
        const legacy = self.sessionTracks.filter(t => configById.has(t.trackId))
        if (legacy.length > 0) {
          const deltas = { ...self.trackConfigDeltas }
          for (const track of legacy) {
            const plainBase = toPlainConfig(configById.get(track.trackId)!)
            const delta = diffTrackConfig(
              plainBase,
              getSnapshot(track),
            ) as PlainTrackConfig
            // a legacy override identical to its base contributes no changed
            // slots: drop it rather than migrate a content-free delta
            if (deltaHasChanges(plainBase, delta)) {
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
        publishTrackConf: superPublishTrackConf,
        deleteTrackConf: superDeleteTrackConf,
        updateTrackConfiguration: superUpdateTrackConfiguration,
      } = self
      // A cleared delta reverts the track's live working copy to the base in
      // place, so an open view re-renders to the default. applySnapshot keeps
      // the node identity (existing observers just update); no-op in admin mode
      // or for a track that was never edited (no working copy).
      //
      // Through toPlainConfig like every other read of a base in this file. The
      // raw entry would do the same, since applySnapshot re-runs the
      // preProcessSnapshot toPlainConfig hydrates through; this makes that
      // reliance explicit.
      function revertEditableTrackConfig(trackId: string) {
        const entry = self.editableTrackConfigs.get(trackId)
        const base = baseTracks(self).find(t => t.trackId === trackId)
        if (entry && base) {
          applySnapshot(entry.node, toPlainConfig(base))
        }
      }
      // Re-stamp a working copy with the delta now in trackConfigDeltas, so the
      // copy this mixin just persisted from stays the one the next read
      // resolves. Read back off the prop rather than reusing the written object,
      // so the stamp is whatever `types.frozen` actually stored.
      function stampEditableTrackConfig(trackId: string) {
        const entry = self.editableTrackConfigs.get(trackId)
        if (entry) {
          entry.delta = self.trackConfigDeltas[trackId]
        }
      }
      // Single writer for trackConfigDeltas (pass undefined to clear). Clearing
      // also reverts the working copy, which is what makes a Reset visible in an
      // open view.
      function writeDelta(
        trackId: string,
        delta: PlainTrackConfig | undefined,
      ) {
        self.trackConfigDeltas = delta
          ? { ...self.trackConfigDeltas, [trackId]: delta }
          : withoutDelta(self.trackConfigDeltas, trackId)
        if (!delta) {
          revertEditableTrackConfig(trackId)
        }
        stampEditableTrackConfig(trackId)
      }
      // Push a *programmatic* update (the config editor's Apply, or any
      // updateTrackConfiguration not driven by this node's own live edits) into
      // the working copy. When the node IS the edit source its snapshot already
      // equals fullConfig, so this skips — which also avoids clobbering an
      // in-progress live drag.
      function syncEditableTrackConfig(
        trackId: string,
        fullConfig: PlainTrackConfig,
      ) {
        const entry = self.editableTrackConfigs.get(trackId)
        if (entry && !compareStructural(getSnapshot(entry.node), fullConfig)) {
          applySnapshot(entry.node, fullConfig)
        }
      }
      // The session-scoped add, shared by the action that always means the
      // session and the one that means it only for a non-admin. A plain closure
      // rather than `this.addSessionTrackConf` so neither action's inferred
      // return type depends on the other's.
      function addToSession(loose: AnyConfiguration) {
        const trackConf = expandLooseTrackConfig(loose, pluginManager)
        const { trackId, type } = trackConf as {
          type: string
          trackId: string
        }
        if (!type) {
          throw new Error(`track type not specified for "${trackId}"`)
        }
        assertTrackConfOutlivesItsAssemblies(self, trackConf, 'sessionTracks')
        // Dedupe against everything the session can already resolve — config
        // catalog (jbrowse.tracks), assembly sequences, connection tracks and
        // prior sessionTracks — not just sessionTracks. Re-adding a config
        // already in the catalog would otherwise push a full shadow into
        // sessionTracks, silently demoting a catalog track to a session track
        // and dropping its trackConfigDeltas override semantics.
        const existing = self.getTrackById(trackId)
        if (existing) {
          if (self.sessionTracks.includes(existing)) {
            assertNotReaddedDifferently(pluginManager, existing, {
              ...trackConf,
              trackId,
              type,
            })
          }
          return existing
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
      }
      return {
        /**
         * #action
         * Add a track config to *this session*: it lands in `sessionTracks`,
         * travels with the session when it is saved or shared, and never
         * reaches the config.json the server hands every visitor.
         *
         * **The default destination.** Everything that is not an Add-track
         * workflow wants this one, whoever is looking — a session spec's
         * `sessionTracks`, a URL's `&sessionTracks=`, and every track a feature
         * stands up on the user's behalf. Mirrors `addSessionConnectionConf` in
         * the connections mixins.
         */
        addSessionTrackConf(trackConf: AnyConfiguration) {
          return addToSession(trackConf)
        },

        /**
         * #action
         * Publish a track config to the shared catalog if this user can, and
         * fall back to their session if they cannot: an admin's goes to
         * `jbrowse.tracks`, which the admin server writes back into the
         * config.json every visitor is served; everyone else's goes to
         * `sessionTracks`.
         *
         * **Call it only from the "Add track" workflows**, where an admin
         * adding a track means to add it for the whole site. For a track a
         * feature creates on the user's behalf (a search result, a computed
         * consensus, a reconstruction's segment labels), one admin click on
         * this publishes it to every visitor, and each later click publishes
         * another copy, because the per-launch trackId prevents deduplication.
         * Use `addSessionTrackConf` above for those.
         *
         * An admin's track still goes to the session when it names an assembly
         * the config.json does not carry: a session spec's assembly, a MAF
         * sample's genome, or a comparative view's synthesized pair. The
         * Add-track widget takes its assembly from the containing view, so an
         * admin adding a track in such a view passes a name no visitor can
         * resolve. Publishing it would write an entry the server sends to every
         * visitor and no visitor can draw. Adding it to the session keeps the
         * track usable and writes no dangling entry; a snackbar names the
         * assembly that caused the fallback.
         *
         * **The snackbar names the assembly and not the track**, so a batch
         * produces one message: `pushSnackbarMessage` dedupes on the exact
         * text, and `BulkAddTracksWorkflow` publishes in a loop. Including the
         * track name would show one snackbar per file to an admin adding
         * thirty. The assembly is all the admin needs to act on.
         */
        publishTrackConf(trackConf: AnyConfiguration) {
          if (!self.adminMode) {
            return addToSession(trackConf)
          }
          const missing = assembliesNotInTheCatalog(self, trackConf)
          if (!missing.length) {
            return superPublishTrackConf(trackConf)
          }
          self.notify(
            `A track naming assembly "${missing.join('", "')}" goes to this session rather than to the site configuration: the config.json does not carry that assembly, so a published track naming it would be served to every visitor and drawn by none of them.`,
            'info',
          )
          return addToSession(trackConf)
        },

        /**
         * #action
         * Deprecated alias of `addSessionTrackConf`. Call that, or
         * `publishTrackConf`.
         *
         * @deprecated
         *
         * The session-scoped add under its old name, for the prebuilt plugin
         * bundles that reach it by name at runtime. See the base mixin's copy
         * for why it survives and why it now means the session; nothing in tree
         * may call it.
         */
        addTrackConf(trackConf: AnyConfiguration) {
          return addToSession(trackConf)
        },

        /**
         * #action
         * Persist a non-admin's edited track config as a delta (trackConfigDeltas)
         * against the admin-owned base — only the changed slots — so the edits
         * persist and are shared while admin changes to untouched fields still
         * flow through. A user-added session track (no base) is edited in place.
         * Everything else (admin edits, opened connection tracks) defers to the
         * base mixin, which routes connection tracks to connectionTrackConfigs and
         * the rest to the jbrowse config.
         */
        updateTrackConfiguration(trackConf: PlainTrackConfig) {
          const { trackId } = trackConf
          const base = self.adminMode
            ? undefined
            : baseTracks(self).find(t => t.trackId === trackId)
          const sessionIdx = self.adminMode
            ? -1
            : self.sessionTracks.findIndex(t => t.trackId === trackId)
          if (base) {
            const plainBase = toPlainConfig(base)
            const delta = diffTrackConfig(
              plainBase,
              trackConf,
            ) as PlainTrackConfig
            // an edit that nets back to the base clears any prior override
            if (deltaHasChanges(plainBase, delta)) {
              // Two views showing the same track each run BaseTrackModel's
              // persist reaction against the shared config node, so a single edit
              // calls this twice with an identical delta (and the config editor
              // can re-save an unchanged config). Skip a structurally-identical
              // re-store: writing a fresh trackConfigDeltas object would churn its
              // identity and make the tracks getter rehydrate a new merged node
              // for no real change.
              const existing = self.trackConfigDeltas[trackId]
              if (!existing || !compareStructural(existing, delta)) {
                writeDelta(trackId, delta)
              }
              syncEditableTrackConfig(trackId, trackConf)
            } else if (trackId in self.trackConfigDeltas) {
              writeDelta(trackId, undefined)
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
          } else {
            // admin edit, or a track with no admin base / sessionTracks entry
            // (an opened connection track, or a homeless in-memory-only edit):
            // the base mixin routes these
            superUpdateTrackConfiguration(trackConf)
            // An admin's edit rewrites the base config itself, so it supersedes
            // any delta: a shared session authored by a non-admin carries their
            // deltas, and an admin opening it edits jbrowse.tracks directly. Left
            // in place, the delta merges straight back over that base in the
            // `tracks` getter and the admin's own edit silently reverts.
            if (self.adminMode && trackId in self.trackConfigDeltas) {
              writeDelta(trackId, undefined)
            }
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
            writeDelta(trackId, undefined)
          }
        },

        /**
         * #action
         */
        deleteTrackConf(trackConf: AnyConfigurationModel) {
          superDeleteTrackConf(trackConf)
          const { trackId } = trackConf
          // A delta only outlives its base if the base is gone, so drop it here
          // rather than strand it. Reachable only programmatically (the UI offers
          // a non-admin Reset, not Delete, for a delta-bearing base track).
          if (trackId in self.trackConfigDeltas) {
            writeDelta(trackId, undefined)
          }
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

// The `isSessionWithSessionTracks` guard that used to live here now lives in
// `@jbrowse/core/util/types` beside the rest of the session capability guards.
// Its only caller was the hierarchical track selector — a plugin, which could
// not reach product-core through the ABI it publishes against, so this package
// was a runtime dependency of two shipped plugins for three type guards.
