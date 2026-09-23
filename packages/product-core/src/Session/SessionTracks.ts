import { readConfObject } from '@jbrowse/core/configuration'
import {
  diffTrackConfig,
  flattenTrackConfigDelta,
  mergeTrackConfig,
} from '@jbrowse/core/util'
import { expandLooseTrackConfig } from '@jbrowse/core/util/tracks'
import {
  applySnapshot,
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import { compareStructural, computed } from 'mobx'

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
import type { IComputedValue } from 'mobx'

export interface PlainTrackConfig {
  trackId: string
  [key: string]: unknown
}

// One working copy, plus the resolved config it mirrors. That stamp is the
// cache key, not trackId — see getEditableTrackConfig.
//
// Exported because it reaches an exported signature, so un-exporting it fails
// TS4058 in three files — and only under `pnpm typecheck`, since jest strips
// types.
export interface EditableTrackConfig {
  node: IAnyStateTreeNode
  source: unknown
}

// jbrowse.tracks holds frozen plain objects in every product; single site for
// the cast from its loose frozen type.
function baseTracks(self: {
  jbrowse: { tracks: unknown }
}): PlainTrackConfig[] {
  return self.jbrowse.tracks as PlainTrackConfig[]
}

function sessionEntries(self: { sessionTracks: IAnyStateTreeNode }) {
  return getSnapshot(self.sessionTracks) as PlainTrackConfig[]
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
  // while a working copy's snapshot is hydrated. Diffing or merging across the
  // two reads every expanded field as an edit, pinning whole adapters into the
  // delta, and every member one form has and the other lacks as a reset. So
  // both sides go through the same schema first; a base is memoized per
  // frozen-base identity, which is stable until a jbrowse.tracks write.
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
       * Tracks the session added, each entry the base its edits
       * (trackConfigDeltas) diff against, as a config.json entry is for a
       * config track.
       */
      sessionTracks: types.stripDefault(
        types.array(pluginManager.pluggableConfigSchemaType('track')),
        [],
      ),
      /**
       * #property
       * Per-track config overrides, keyed by trackId, stored as a *delta*
       * against the base config (the sessionTracks or jbrowse.tracks entry)
       * rather than a full copy —
       * so a later change to an untouched field of the base still flows through
       * (see trackConfigDelta.ts). A `null` member resets a slot the base sets.
       * An admin's edits land here too, and reach jbrowse.tracks only through
       * `promoteTrackConfigDeltas`. Frozen (not a typed track array) on purpose: a typed
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
       * Per-track private working copies, keyed by trackId. A plain
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
       * Each entry carries the resolved config it mirrors, so a delta or base
       * replaced from outside this mixin invalidates it — see
       * `getEditableTrackConfig`.
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
      // jbrowse.tracks write or a sessionTracks entry replaced. This relies on
      // a base config never mutating in place. If an in-place base edit is ever
      // added, key this cache on base content too.
      const mergeCache = new WeakMap<
        object,
        { delta: PlainTrackConfig; merged: AnyConfigurationModel }
      >()
      function withDelta(
        base: PlainTrackConfig,
        delta: PlainTrackConfig | undefined,
      ) {
        if (!delta) {
          return base as unknown as AnyConfigurationModel
        }
        const cached = mergeCache.get(base)
        if (cached?.delta === delta) {
          return cached.merged
        }
        const merged = mergeTrackConfig(
          toPlainConfig(base),
          delta,
        ) as unknown as AnyConfigurationModel
        mergeCache.set(base, { delta, merged })
        return merged
      }
      // The bases in `tracks` order, each id's base and each id's position.
      // A config.json that repeats an id resolves to its last entry.
      const trackBaseIndex = computed(
        () => {
          const entries = sessionEntries(self)
          const sessionIds = new Set(entries.map(t => t.trackId))
          const list = [
            ...entries,
            ...baseTracks(self).filter(t => !sessionIds.has(t.trackId)),
          ]
          const byId = new Map<string, PlainTrackConfig>()
          const at = new Map<string, number>()
          for (let i = 0; i < list.length; i++) {
            const { trackId } = list[i]!
            byId.set(trackId, list[i]!)
            at.set(trackId, i)
          }
          return { list, byId, at }
        },
        { name: 'trackBaseIndex' },
      )
      const baseByIdComputeds = new Map<
        string,
        IComputedValue<PlainTrackConfig | undefined>
      >()
      const editableComputeds = new Map<
        IAnyType,
        Map<string, IComputedValue<AnyConfigurationModel | undefined>>
      >()
      return {
        /**
         * #getter
         * Each track's base by trackId: its sessionTracks entry, else its
         * config.json entry. Rebuilt when either list changes, never on an
         * edit.
         */
        get trackBasesById(): Map<string, AnyConfigurationModel> {
          return trackBaseIndex.get().byId as unknown as Map<
            string,
            AnyConfigurationModel
          >
        },
        /**
         * #method
         * `base` with its delta (trackConfigDeltas) merged over it, or `base`
         * itself by identity when it has none, which keeps the hydration cache
         * warm.
         */
        withTrackEdits(base: AnyConfigurationModel): AnyConfigurationModel {
          const plain = base as unknown as PlainTrackConfig
          return withDelta(plain, self.trackConfigDeltas[plain.trackId])
        },
        /**
         * #getter
         * Session tracks first, then the config tracks, each with its edits.
         * An edit copies the list of bases and lays each delta at its track's
         * position, so its cost is the count of edited tracks, not of tracks.
         */
        get tracks(): AnyConfigurationModel[] {
          const { list, at } = trackBaseIndex.get()
          const tracks = list.slice() as unknown as AnyConfigurationModel[]
          for (const [trackId, delta] of Object.entries(
            self.trackConfigDeltas,
          )) {
            const i = at.get(trackId)
            if (i !== undefined) {
              tracks[i] = withDelta(list[i]!, delta)
            }
          }
          return tracks
        },
        /**
         * #method
         * The entry `trackId` edits over, hydrated: the one the session added
         * it with, or its config.json entry. What a display's "is this
         * arranged" and "reset" compare its live config against. Per-id
         * reactive, like `getTrackById`.
         */
        baseTrackConfig(trackId: string): PlainTrackConfig | undefined {
          let c = baseByIdComputeds.get(trackId)
          if (!c) {
            c = computed(() => {
              const base = self.trackBasesById.get(trackId)
              return base
                ? toPlainConfig(base as unknown as PlainTrackConfig)
                : undefined
            })
            baseByIdComputeds.set(trackId, c)
          }
          return c.get()
        },
        /**
         * #method
         * The config node `trackId` resolves to: a live node as it stands,
         * otherwise a private working copy of its current frozen (base+delta)
         * config, so a shown track's in-place quick-edits (setSlot) mutate
         * this copy and never the shared frozen base (see ADR-032). Called by
         * TrackConfigurationReference during lazy hydration.
         *
         * Cached against the resolved config it was built from, not by trackId
         * alone. A write this mixin makes re-stamps the entry, so the copy an
         * edit is still being typed into is never swapped out mid-keystroke;
         * a delta or base replaced from outside — an undo's `applySnapshot` on
         * the session, a session restore, a session track deleted and added
         * again under its id — cannot, so the next read rebuilds the copy from
         * what now resolves. Per-id reactive on the node rather than the
         * config, so a display reading its config does not recompute when
         * its own working copy is persisted. Per schema type as well, since
         * an id re-added under another track type resolves through that
         * type's reference.
         */
        getEditableTrackConfig(
          trackId: string,
          schemaType: IAnyType,
        ): AnyConfigurationModel | undefined {
          let byId = editableComputeds.get(schemaType)
          if (!byId) {
            byId = new Map()
            editableComputeds.set(schemaType, byId)
          }
          let c = byId.get(trackId)
          if (!c) {
            c = computed(() => {
              const resolved = self.getTrackById(trackId)
              if (!resolved || isStateTreeNode(resolved)) {
                return resolved
              }
              const existing = self.editableTrackConfigs.get(trackId)
              if (existing?.source === resolved) {
                return existing.node
              }
              const node = schemaType.create(resolved, { pluginManager })
              self.editableTrackConfigs.set(trackId, { node, source: resolved })
              return node
            })
            byId.set(trackId, c)
          }
          return c.get()
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * The overridden slots for `trackId` (empty when it has no delta): each
       * changed setting's path, its base/default value and the edited value.
       * Drives the "view changes" dialog opened from the edited badge.
       */
      getTrackConfigChanges(trackId: string) {
        // Every rendered track row asks this (the edited badge); only an
        // edited one has a delta, so an unedited row subscribes to no base.
        const delta = self.trackConfigDeltas[trackId]
        const base = delta ? self.baseTrackConfig(trackId) : undefined
        return delta && base ? flattenTrackConfigDelta(base, delta) : []
      },
    }))
    .views(self => ({
      /**
       * #method
       * Whether `trackId` carries an edit over its base config, which drives
       * the "Reset track settings" item and the edited badge. Changed slots,
       * not mere presence in trackConfigDeltas: a delta can hold only
       * content-free display stubs, which must not read as an override.
       */
      isTrackOverride(trackId: string): boolean {
        return self.getTrackConfigChanges(trackId).length > 0
      },
      /**
       * #getter
       * The edited tracks `promoteTrackConfigDeltas` can write: those whose
       * base is a config.json entry. A session track's delta has no file to
       * go to.
       */
      get promotableTrackIds(): string[] {
        const sessionIds = new Set(self.sessionTracks.map(t => t.trackId))
        return Object.keys(self.trackConfigDeltas).filter(
          id => !sessionIds.has(id) && self.trackBasesById.has(id),
        )
      },
    }))
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
      // the node identity (existing observers just update); no-op for a track
      // that was never shown (no working copy).
      function revertEditableTrackConfig(trackId: string) {
        const entry = self.editableTrackConfigs.get(trackId)
        const base = self.baseTrackConfig(trackId)
        if (entry && base) {
          applySnapshot(entry.node, base)
        }
      }
      // Re-stamp a working copy with what its track resolves to after a write,
      // so the copy this mixin just persisted from stays the one the next read
      // resolves.
      function stampEditableTrackConfig(trackId: string) {
        const entry = self.editableTrackConfigs.get(trackId)
        if (entry) {
          entry.source = self.getTrackById(trackId)
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
      // A working copy's own snapshot, which both savers pass, is already in
      // the schema's form; anything else a caller hands in may not be.
      function inTrackForm(trackConf: PlainTrackConfig) {
        const entry = self.editableTrackConfigs.get(trackConf.trackId)
        return entry && getSnapshot(entry.node) === trackConf
          ? trackConf
          : hydrate(trackConf)
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
          const entry = self.sessionTracks.find(t => t.trackId === trackId)
          if (entry) {
            assertNotReaddedDifferently(pluginManager, entry, {
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
         *
         * Returns the entry, which is the track's base: edit the track through
         * `updateTrackConfiguration` or a display's `setConf`, not the entry.
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
         * Persist an edited track config as a delta (trackConfigDeltas) against
         * its base, the sessionTracks or config.json entry — only the changed
         * slots — so the edits persist, are shared, undo and reset, while
         * changes to untouched fields of the base still flow through. An
         * admin's edit is a delta like anyone's: it reaches the config.json the
         * server hands every visitor only through `promoteTrackConfigDeltas`.
         * An opened connection track defers to the base mixin, which routes it
         * to connectionTrackConfigs.
         */
        updateTrackConfiguration(trackConf: PlainTrackConfig) {
          const { trackId } = trackConf
          const plainBase = self.baseTrackConfig(trackId)
          if (plainBase) {
            const delta = diffTrackConfig(
              plainBase,
              inTrackForm(trackConf),
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
          } else {
            // an opened connection track, or a homeless in-memory-only edit
            superUpdateTrackConfiguration(trackConf)
            syncEditableTrackConfig(trackId, trackConf)
            stampEditableTrackConfig(trackId)
          }
        },

        /**
         * #action
         * Write this session's track edits into the base configs — the
         * config.json an admin server hands every visitor — and drop the
         * deltas they were held in. One track's, or every track's when
         * `trackId` is omitted, of `promotableTrackIds`: a session track's
         * edits stay in the session. An admin's alone: anyone else's base is
         * the in-memory copy of a file they cannot write.
         */
        promoteTrackConfigDeltas(trackId?: string) {
          if (!self.adminMode) {
            throw new Error('only an admin can save track settings to config')
          }
          const promotable = self.promotableTrackIds
          const ids =
            trackId === undefined
              ? promotable
              : promotable.includes(trackId)
                ? [trackId]
                : []
          const bases = self.trackBasesById
          for (const id of ids) {
            const base = bases.get(id) as unknown as PlainTrackConfig
            self.jbrowse.updateTrackConf(
              mergeTrackConfig(
                toPlainConfig(base),
                self.trackConfigDeltas[id]!,
              ),
            )
            writeDelta(id, undefined)
          }
        },

        /**
         * #action
         * Drop a track's delta (trackConfigDeltas) so it reverts to its base,
         * the sessionTracks or jbrowse.tracks entry. Unlike deleteTrackConf this
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
          // rather than strand it.
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
