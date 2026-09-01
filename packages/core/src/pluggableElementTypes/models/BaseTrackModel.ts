import { lazy } from 'react'

import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import Save from '@mui/icons-material/Save'
import { compareStructural, reaction } from 'mobx'

import { ConfigurationReference, getConf } from '../../configuration/index.ts'
import {
  releaseAdapterSession,
  retainAdapterSession,
} from '../../data_adapters/adapterSessionRefcount.ts'
import { adapterConfigCacheKey } from '../../data_adapters/dataAdapterCache.ts'
import { adapterByteLimit } from '../../rpc/byteBudget.ts'
import {
  getContainingView,
  getDialogHost,
  getEnv,
  getSession,
} from '../../util/index.ts'
import {
  getConfAssemblyNamesOrNone,
  viewDisplayNames,
} from '../../util/tracks.ts'
import { isSessionModelWithConfigEditing } from '../../util/types/index.ts'
import { ElementId } from '../../util/types/mst.ts'
import { stringifyBED } from './saveTrackFileTypes/bed.ts'
import { stringifyGBK } from './saveTrackFileTypes/genbank.ts'
import { stringifyGFF3 } from './saveTrackFileTypes/gff3.ts'

import type PluginManager from '../../PluginManager.ts'
import type { RefNameMismatch } from '../../assemblyManager/refNameMismatch.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '../../configuration/index.ts'
import type { MenuItem } from '../../ui/index.ts'
import type { DisplayModel } from './BaseDisplayModel.tsx'
import type { FileTypeExporter } from './saveTrackFileTypes/types.ts'
import type {
  IAnyStateTreeNode,
  IType,
  Instance,
} from '@jbrowse/mobx-state-tree'

const SaveTrackDataDlg = lazy(() => import('./components/SaveTrackData.tsx'))

const DEFAULT_EXPORT_BYTE_LIMIT = 5_000_000

interface DisplayConf {
  displayId: string
  type: string
}

function getCompatibleDisplays(self: IAnyStateTreeNode) {
  const { pluginManager } = getEnv(self)
  const view = getContainingView(self)
  // which of THIS track's configured displays the view draws — a different
  // question from viewCanDisplayTrack's "can it open the track at all", over
  // the same set of names
  const compatTypes = viewDisplayNames(pluginManager, view.type)
  const displays = self.configuration.displays as AnyConfigurationModel[]
  return displays.filter(d => compatTypes.has(d.type))
}

function getDisplayConf(displays: DisplayConf[], displayId: string) {
  const displayConf = displays.find(d => d.displayId === displayId)
  if (!displayConf) {
    throw new Error(`could not find display config ${displayId}`)
  }
  return displayConf
}

/**
 * #stateModel BaseTrackModel
 * #category track
 *
 * these MST models only exist for tracks that are *shown*. they should contain
 * only UI state for the track, and have a reference to a track configuration.
 * note that multiple displayed tracks could use the same configuration.
 */
export function createBaseTrackModel(
  pm: PluginManager,
  trackType: string,
  baseTrackConfig: AnyConfigurationSchemaType,
) {
  return types
    .model(trackType, {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal(trackType),
      /**
       * #property
       */
      configuration: ConfigurationReference(baseTrackConfig),
      /**
       * #property
       */
      minimized: types.stripDefault(types.boolean, false),
      /**
       * #property
       */
      pinned: types.stripDefault(types.boolean, false),
      /**
       * #property
       * The runtime plugin union (`pluggableMstType`) is typed only as
       * `IAnyType`, erasing the element to `any`. Assert the concrete
       * `DisplayModel` instance every registered display satisfies so reads
       * (`activeDisplay`, `trackMenuItems`) are checked;
       * create/snapshot stay `unknown` since the union's snapshot shape is
       * genuinely dynamic (`replaceDisplay` writes a partial snapshot).
       */
      displays: types.array(
        pm.pluggableMstType('display', 'stateModel') as unknown as IType<
          unknown,
          unknown,
          DisplayModel
        >,
      ),
    })
    .volatile(() => ({
      /**
       * Whether a height-resize gesture is in progress on this track. Set by
       * whichever handle owns the drag — the view's track resize handle, or a
       * handle a display draws inside itself — and read by displays that sit an
       * expensive per-frame layer out of the gesture.
       *
       * On the track rather than the display because the gesture belongs to the
       * container running it, not to whatever display happens to be active: the
       * view can bracket a drag without knowing which display it landed on, and
       * two handles on one track share one flag rather than racing to clear
       * each other's.
       */
      resizing: false,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get trackId() {
        return self.configuration.trackId as string
      },
      /**
       * #getter
       * determines which webworker to send the track to, currently based on trackId
       */
      get rpcSessionId() {
        // no `adapter ? … : this.trackId` fallback: the slot always materializes
        // an object (see `adapterConfig` below, and
        // adapterSlotAlwaysMaterializes.test.ts), so the trackId arm was dead and
        // read as though a track could have no adapter.
        //
        // `this`, not `self` — `adapterConfig` is declared in this same `.views`
        // block, so `self` does not carry it yet.
        return adapterConfigCacheKey(this.adapterConfig)
      },
      /**
       * #getter
       */
      get name() {
        return (getConf(self, 'name') as string) || this.trackId
      },
      /**
       * #getter
       * this track's own name-search index, from the `textSearching`
       * sub-config. `undefined` when the track has none.
       *
       * The path, not a bare `'textSearchAdapter'`: the slot is
       * `textSearching.textSearchAdapter` (`baseTrackConfig.ts`), and a bare
       * read of a name no schema declares returns `undefined` and reports
       * nothing at any layer, so this getter answered `undefined` for every
       * track ever configured with one. `TextSearchManager` reads the same slot
       * by hand-walking `conf.textSearching.textSearchAdapter`, which is why
       * nothing noticed.
       */
      get textSearchAdapter() {
        return getConf(self, ['textSearching', 'textSearchAdapter'])
      },

      /**
       * #getter
       */
      get adapterConfig(): Record<string, unknown> {
        // Annotated, not left to infer `getConf`'s `any`, which switches off
        // checking at every reader downstream.
        //
        // NOT `| undefined`, which was tried and measured. `adapter` is a bare
        // `types.union` of the registered adapter schemas
        // (`pluggableConfigSchemaType`) with no `maybe` and no default — which
        // looks absent-able, but every member is an all-optional config schema,
        // so MST creates the first one rather than leaving the slot empty. Probed
        // both ways: omitting `adapter` entirely, and passing it explicitly as
        // `undefined`, each read back as an object. So `| undefined` propagates a
        // case that cannot happen to ~33 call sites.
        return getConf(self, 'adapter')
      },

      /**
       * #getter
       * a shown track always has at least one display
       */
      get activeDisplay() {
        return self.displays[0]!
      },

      /**
       * #getter
       */
      get canConfigure() {
        const session = getSession(self)
        const { sessionTracks, trackConfigDeltas, adminMode } = session
        return (
          isSessionModelWithConfigEditing(session) &&
          (adminMode ||
            !!sessionTracks?.find(t => t.trackId === this.trackId) ||
            this.trackId in (trackConfigDeltas ?? {}))
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Set when this track's file and one of its assemblies share no reference
       * name at all — the `1/2/3` file loaded against a `chr1/chr2/chr3`
       * assembly, which otherwise draws an empty track and says nothing.
       *
       * The verdict is reached in `loadRefNameMap`, which is the only place both
       * name sets are in scope, and recorded on the *assembly* because nothing
       * in the assembly manager can reach a track (the session is a sibling
       * subtree, so `getSession` from there finds only the root). The lookup
       * inverts that: the record is keyed by adapter cache key, which is exactly
       * what `rpcSessionId` already is, so a track finds its own with no
       * plumbing in between.
       *
       * The names come from `getConfAssemblyNamesOrNone`, not from a raw
       * `assemblyNames` slot read: this model is shared by every track type, and
       * `ReferenceSequenceTrack`'s schema does not declare that slot — it names
       * its assembly by being the `sequence` of one. A raw read there returns
       * `undefined` with no diagnostic at any layer, so the getter was inert for
       * that one track type while looking like it worked. The `OrNone` half is
       * what keeps this total: it runs on every render of every track label, and
       * an unanswerable question must not become a thrown getter.
       *
       * Diagnostic only. It gates nothing, and a track carrying one still loads,
       * still fetches and still draws whatever it can.
       */
      get refNameMismatch(): RefNameMismatch | undefined {
        const { assemblyManager } = getSession(self)
        for (const name of getConfAssemblyNamesOrNone(self.configuration)) {
          // screened with `has` first: `get` reports a name the session lacks
          // to Core-handleUnrecognizedAssembly, and this getter runs on every
          // render of every track label. A track config is free to name an
          // assembly the session has no configuration for, and asking about it
          // must not tell every installed plugin to go resolve it.
          const mismatch = assemblyManager.has(name)
            ? assemblyManager.get(name)?.getRefNameMismatch(self.rpcSessionId)
            : undefined
          if (mismatch) {
            return mismatch
          }
        }
        return undefined
      },
      /**
       * #getter
       */
      get adapterType() {
        // Checks the adapter's `type`, not the adapter config's presence. The
        // config is always an object (see `adapterConfig`), so the old
        // `if (!adapterConfig) throw` could not fire; what genuinely can be
        // missing is `type`, and it is a string only by convention since the slot
        // holds an arbitrary sub-config. Unchecked it reaches
        // `getAdapterType(undefined)`, which does throw — but as
        // `AdapterType 'undefined' is not registered`, i.e. as a missing plugin,
        // sending the reader after a build problem instead of at the config
        // that names no adapter type.
        const { type } = self.adapterConfig
        if (typeof type !== 'string') {
          throw new Error(
            `no adapter type in the adapter configuration for ${self.type} (got ${typeof type})`,
          )
        }
        return pm.getAdapterType(type)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setPinned(flag: boolean) {
        self.pinned = flag
      },
      /**
       * #action
       */
      setMinimized(flag: boolean) {
        self.minimized = flag
      },
      /**
       * #action
       */
      setResizing(flag: boolean) {
        self.resizing = flag
      },

      /**
       * #action
       * `applyDisplaySettings` on the display being drawn (`activeDisplay`,
       * which a shown track always has — this is not meaningful on a bare
       * config node) — the track-level entry for "restyle this track in
       * place" (a session spec's inline keys, an agent's settings bag). Only
       * that one display: settings vocabularies are per display type, so
       * broadcasting one bag across a track's other displays would mis-route
       * keys; address a non-active display directly if that is what you mean.
       * See BaseDisplayModel for the routing and the `allowSetters` opt-in.
       */
      applyDisplaySettings(
        settings: Record<string, unknown>,
        options?: { allowSetters?: boolean },
      ) {
        return self.activeDisplay.applyDisplaySettings(settings, options)
      },

      /**
       * #action
       */
      replaceDisplay(
        oldDisplayId: string,
        newDisplayId: string,
        initialSnapshot = {},
      ) {
        const idx = self.displays.findIndex(
          d => d.configuration.displayId === oldDisplayId,
        )
        if (idx === -1) {
          throw new Error(
            `could not find display id ${oldDisplayId} to replace`,
          )
        }
        const displays = self.configuration.displays as DisplayConf[]
        const displayConf = getDisplayConf(displays, newDisplayId)
        self.displays[idx] = {
          ...initialSnapshot,
          type: displayConf.type,
          configuration: newDisplayId,
        }
      },

      /**
       * #action
       * Persist any config-schema mutation (quick track-menu edits calling
       * `setSlot` directly, or the full Settings dialog) back to the session,
       * debounced, mirroring ConfigurationEditorWidget's own save. Both savers
       * intentionally coexist — this one covers direct setSlot edits on a shown
       * track, the widget covers an unshown track edited from the selector (no
       * BaseTrackModel). When both fire they compute an identical delta, deduped
       * in updateTrackConfiguration; don't drop one to "simplify". `reaction`
       * (not `autorun`) on purpose: `self.configuration` is defined
       * immediately on attach, unlike ConfigurationEditorWidget's `target`
       * (which starts undefined), so an autorun's guaranteed first run would
       * otherwise schedule a spurious flush for every track ever shown, even
       * completely untouched ones — `reaction` only fires on an actual change.
       *
       * `equals: compareStructural` is load-bearing, not an optimization:
       * `self.configuration` is a re-resolving reference, and persisting a save
       * swaps the resolved node identity (admin `updateTrackConf` replaces the
       * frozen `jbrowse.tracks` entry, rehydrating a brand-new MST node; the
       * non-admin path reconciles in place but still churns once). Referential
       * comparison would treat every such swap as a fresh change and re-fire the
       * save, which for the admin/desktop path (new node every write) is an
       * unbounded debounced loop. Structural comparison settles once the content
       * stops changing.
       */
      afterAttach() {
        let timeout: ReturnType<typeof setTimeout> | undefined
        addDisposer(
          self,
          reaction(
            () => getSnapshot(self.configuration),
            snapshot => {
              clearTimeout(timeout)
              timeout = setTimeout(() => {
                const session = getSession(self)
                if (isSessionModelWithConfigEditing(session)) {
                  session.updateTrackConfiguration(
                    snapshot as { trackId: string; [key: string]: unknown },
                  )
                }
              }, 400)
            },
            { equals: compareStructural },
          ),
        )
        addDisposer(self, () => {
          clearTimeout(timeout)
        })

        // Hold a claim on this track's rpcSessionId for as long as the track is
        // open, so closing the last track using an adapter config evicts that
        // adapter from the worker's dataAdapterCache. Without this nothing in
        // the app ever reaches CoreFreeResources, and an adapter — with its
        // parsed chunks, or in the unindexed case its whole parsed file — is
        // reachable from module scope for as long as the worker lives, which no
        // amount of garbage collection can help with.
        //
        // The id is tracked by reaction rather than captured once: rpcSessionId
        // is derived from the adapter config, which a settings edit can change
        // under a live track, and releasing an id we never retained would free
        // an adapter another track is still using.
        const { rpcManager } = getSession(self)
        let retained = self.rpcSessionId
        retainAdapterSession(rpcManager, retained)
        addDisposer(
          self,
          reaction(
            () => self.rpcSessionId,
            next => {
              if (next !== retained) {
                const previous = retained
                retained = next
                retainAdapterSession(rpcManager, next)
                void releaseAdapterSession(rpcManager, previous)
              }
            },
          ),
        )
        addDisposer(self, () => {
          void releaseAdapterSession(rpcManager, retained)
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether this track's adapter writes an export format itself, rather
       * than the save dialog rebuilding one out of rendered features. A claim
       * about the adapter type, not about a given format — the fetch still
       * falls back when the adapter declines the one that was asked for.
       */
      get exportsDataViaAdapter(): boolean {
        return getEnv(self)
          .pluginManager.getAdapterType(getConf(self, ['adapter']).type)
          .adapterCapabilities.includes('exportData')
      },
      /**
       * #getter
       * What "Save track data" may pull before it asks. The adapter's own
       * `fetchSizeLimit` where it declares one, so a save does not quietly
       * disagree with the size this track's display already refuses to render;
       * otherwise a default. Deliberately generous — unlike the display's gate
       * this is a confirmation rather than a refusal, and the user asked for
       * these bytes by name.
       */
      get exportByteLimit(): number {
        return adapterByteLimit(
          getConf(self, ['adapter', 'fetchSizeLimit']),
          DEFAULT_EXPORT_BYTE_LIMIT,
        )
      },
      /**
       * #method
       */
      saveTrackFileFormatOptions(): Record<string, FileTypeExporter> {
        return {
          gff3: {
            name: 'GFF3',
            extension: 'gff3',
            callback: stringifyGFF3,
          },
          genbank: {
            name: 'GenBank',
            extension: 'gbk',
            callback: stringifyGBK,
            helpText:
              'Note: GenBank format export is experimental. The generated output may not fully conform to the GenBank specification and should be validated before use in production workflows.',
          },
          bed: {
            name: 'BED',
            extension: 'bed',
            callback: stringifyBED,
          },
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the "Save track data" menu entry. Kept separate from trackMenuItems so
       * consumers (e.g. the LGV track-label menu) can place it alongside the
       * session's Settings/Copy/Delete track actions without fishing it back out
       * of the general list
       */
      get saveTrackDataMenuItem(): MenuItem {
        return {
          label: 'Save track data',
          icon: Save,
          priority: 998,
          onClick: () => {
            getDialogHost(self).queueDialog(handleClose => [
              SaveTrackDataDlg,
              {
                model: self,
                handleClose,
              },
            ])
          },
        }
      },
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        const menuItems = self.displays.flatMap(d => d.trackMenuItems())
        const shownId = self.activeDisplay.configuration.displayId
        const compatDisp = getCompatibleDisplays(self)

        return [
          ...menuItems,
          ...(compatDisp.length > 1 && shownId
            ? [
                {
                  type: 'subMenu' as const,
                  label: 'Display types',
                  priority: -1000,
                  subMenu: compatDisp.map(d => {
                    const displayType = pm.getDisplayType(d.type)
                    return {
                      type: 'radio' as const,
                      label: displayType.displayName,
                      helpText: displayType.helpText,
                      checked: d.displayId === shownId,
                      // opts out of the checkbox/radio "stay open" default:
                      // every row above this submenu came from the display
                      // being replaced, so leaving the menu up would keep a
                      // list of items built against a destroyed MST node
                      keepMenuOpen: false,
                      onClick: () => {
                        if (d.displayId !== shownId) {
                          self.replaceDisplay(
                            shownId,
                            d.displayId,
                            self.activeDisplay.getPortableSettings?.(
                              d.displayId,
                            ) ?? {},
                          )
                        }
                      },
                    }
                  }),
                },
              ]
            : []),
        ]
      },
    }))
}

export type BaseTrackStateModel = ReturnType<typeof createBaseTrackModel>
export type BaseTrackModel = Instance<BaseTrackStateModel>
