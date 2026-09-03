import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'

import type { FetchLifecycleHost } from './FetchMixin.ts'
import type { StopTokenRotation } from '@jbrowse/core/util/createStopTokenRotation'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The members a fetch installer reads off a display composing this mixin, the
 * way `GlobalFetchHost` names `FetchMixin`'s: the rotation the installer lends
 * to the skeleton so `cancelFetch` and the Cancel button reach the fetch it
 * installs, the freshness pair the skeleton gates on, and the commit that
 * stamps it. The `Instance` type would be circular from inside a file the
 * mixin composes.
 */
export interface KeyedFetchHost extends IStateTreeNode, FetchLifecycleHost {
  fetchRotation: StopTokenRotation
  currentFetchKey: string | undefined
  loadedFetchKey: string | undefined
  commitFetchResult: (commit: () => void, key: string) => void
}

/**
 * #stateModel KeyedFetchMixin
 * #category display
 *
 * `FetchMixin` plus the one freshness compare a single-payload fetch runs: the
 * key of what the view, settings and adapter call for (`currentFetchKey`)
 * against the key the held data was committed under (`loadedFetchKey`). The
 * LGV global family composes it under `GlobalFetchMixin` and the comparative
 * family under `ComparativeFetchMixin`; the per-region family answers the same
 * question per region through `isCacheValid`, so it stays on `FetchMixin`.
 *
 * It was `GlobalFetchMixin`'s middle until 2026-09, while the comparative
 * displays carried a second spelling of every member here on
 * `SyntenyFetchStateMixin` — the same stamp, the same compare, a `fetching`
 * flag standing in for `activeStopToken`, and a `reload` that dropped the stamp
 * for the same reason. ADR-105.
 */
export default function KeyedFetchMixin() {
  return types
    .compose('KeyedFetchMixin', FetchMixin(), types.model({}))
    .volatile(() => ({
      /**
       * #volatile
       * `currentFetchKey` as it stood when the held data was committed — the
       * loaded half of the freshness compare. Written only by
       * `commitFetchResult`, so a display cannot stamp data it did not fetch,
       * and cleared by `reload` for the overlay's sake rather than the
       * refetch's (the skeleton's reload epoch is what overrides its gate).
       * The data itself stays display-owned: arc keeps stale arcs on screen
       * under the loading overlay, HiC the stale matrix, synteny the stale
       * ribbons.
       */
      loadedFetchKey: undefined as string | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook, the one freshness input a display supplies: the
       * signature of what the current *view* calls for — its block set
       * (`blockKeySignature`) plus any view-derived fetch tier, like HiC's
       * binsize; both comparative views' region sets, zoom buckets and LOD
       * tier. `undefined` means "not computable yet" (view unmeasured, a
       * prerequisite header still in flight) and holds the fetch off.
       *
       * Settings and the adapter are deliberately not the display's half:
       * `currentFetchKey` below appends `rpcPropsCacheKey` and
       * `adapterConfigKey`, so a field added to `rpcProps()` or a track
       * re-pointed in the config editor invalidates held data structurally.
       * HiC hand-folded one settings term in and would have silently missed
       * the second; the comparative family folded the adapter in at its
       * installer and compared without it at its export gate.
       *
       * Default `undefined`, so a display that forgets the override never
       * fetches and never exports — hung is diagnosable, stale ships wrong
       * pixels.
       */
      get viewSignature(): string | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook (default false): the held data answers the key, but
       * this display knows it is not what the screen will settle on — a
       * dependent fetch of its own is still out, or a fetch input it writes
       * itself has moved. The same hook `MultiRegionDisplayMixin` declares,
       * for the same reason: the key compare is structurally blind to
       * anything the display fetches outside its primary fetch, and an export
       * sampling `svgReady` in that window paints the half-filled frame.
       *
       * A term of `dataCurrent` and NOT of the skeleton's freshness gate, so it
       * holds the export and never re-runs the primary fetch. It fails hung, not
       * stale: a value that latches true parks `awaitSvgReady` on its backstop,
       * so state only what a later commit is guaranteed to clear.
       */
      get dataSuperseded(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Key of the fetch the current view, settings and adapter call for — the
       * display's `viewSignature` plus the serialized `rpcProps()` axis plus
       * the adapter config. The fetch skeleton's freshness key: captured at
       * issue, compared against the stamp above, and written to it at commit.
       */
      get currentFetchKey(): string | undefined {
        const base = self.viewSignature
        return base === undefined
          ? undefined
          : `${base}|${self.rpcPropsCacheKey}|${self.adapterConfigKey}`
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The shared freshness answer every foundation gives: data has been
       * committed (`loadedFetchKey` is only ever written beside it), it was
       * fetched for the current view and settings, and the display is not
       * about to supersede it itself. A pan inside the loaded blocks stays
       * current; a block entering, a tier step, a settings change or a
       * `reload()` moves one side of the compare. **What the fetch autorun
       * gates on is the same compare inside `installFetch`**, not this getter —
       * the skeleton owns it so a reload can override it. This one is for the
       * readers outside the fetch, the export gate above all. The per-region
       * twin is `isCacheValid`: what decides a refetch, and deliberately not
       * the whole freshness answer.
       */
      get dataCurrent(): boolean {
        return (
          isDataCurrent(self.loadedFetchKey, self.currentFetchKey) &&
          !self.dataSuperseded
        )
      },
    }))
    .actions(self => {
      const superReload = self.reload
      return {
        /**
         * #action
         * The commit half of a keyed fetch: run the display's own store in the
         * same transaction as the key stamp, so no observer can see fresh data
         * under a stale key or the reverse. Being the only writer of
         * `loadedFetchKey` is what makes `dataCurrent` derivable — a display
         * cannot commit without stamping.
         */
        commitFetchResult(commit: () => void, key: string) {
          commit()
          self.loadedFetchKey = key
        },
        /**
         * #action
         * `FetchMixin.reload` (error, cancel, counter — the shared skeleton's
         * reload epoch is what makes that bump override the freshness gate, even
         * against a fetch that commits mid-reload, so nothing here has to
         * remember to invalidate for the retry's sake) plus this layer's one
         * addition, for the export gate rather than the refetch: dropping the
         * loaded key sends `dataCurrent` false, so an export started after the
         * click waits for the refetch instead of capturing what the retry is
         * about to replace. The data itself survives, staying on screen under
         * that overlay. A subclass whose reload needs extra teardown can
         * override and chain.
         */
        reload() {
          superReload()
          self.loadedFetchKey = undefined
        },
      }
    })
}

export type KeyedFetchMixinType = ReturnType<typeof KeyedFetchMixin>
