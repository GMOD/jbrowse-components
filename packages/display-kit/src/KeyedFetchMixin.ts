import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'
import { stableIdentityComputed } from './stableIdentityComputed.ts'

import type { FetchLifecycleHost } from './FetchMixin.ts'
import type { AbortRotation } from '@jbrowse/core/util/createAbortRotation'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What a fetch installer reads off a display composing this mixin: the
 * rotation it lends the skeleton, so Cancel reaches the fetch, the freshness
 * pair it gates on, and the commit that stamps it.
 */
export interface KeyedFetchHost extends IStateTreeNode, FetchLifecycleHost {
  fetchRotation: AbortRotation
  currentFetchKey: FetchKey | undefined
  loadedFetchKey: FetchKey | undefined
  commitFetchResult: (commit: () => void, key: FetchKey) => void
}

/**
 * What a keyed fetch is issued for, compared by `isDataCurrent`: the display's
 * `viewSignature` and `settingsFetchInputs`.
 */
export interface FetchKey {
  view: string
  settings: unknown
}

/**
 * #stateModel KeyedFetchMixin
 * #category display
 *
 * `FetchMixin` plus the freshness compare a single-payload fetch runs: the key
 * the view, settings and adapter call for (`currentFetchKey`) against the key
 * the held data was committed under (`loadedFetchKey`). Composed by
 * `GlobalFetchMixin` and `ComparativeFetchMixin` (ADR-105).
 */
export default function KeyedFetchMixin() {
  return types
    .compose('KeyedFetchMixin', FetchMixin(), types.model({}))
    .volatile(() => ({
      /**
       * #volatile
       * `currentFetchKey` as it stood when the held data was committed.
       * Written only by `commitFetchResult` and cleared by `reload`; the data
       * itself is the display's and stays on screen under the overlay.
       */
      loadedFetchKey: undefined as FetchKey | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook, the freshness input a display supplies: what the
       * current view calls for, such as its block set (`blockKeySignature`)
       * plus any view-derived tier like HiC's bin size. Leave settings out;
       * `currentFetchKey` pairs this with `settingsFetchInputs`. `undefined`
       * holds the fetch off, and is the default, so a missing override hangs
       * rather than draws stale data.
       */
      get viewSignature(): string | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook (default false): the held data matches the key but
       * the screen will settle on different data, as when a dependent fetch is
       * still out. A term of `dataCurrent` only, so it holds the export and
       * never refetches; state only what a later commit is sure to clear.
       * See `MultiRegionDisplayMixin.dataSuperseded`.
       */
      get dataSuperseded(): boolean {
        return false
      },
    }))
    .views(self => {
      const key = stableIdentityComputed((): FetchKey | undefined => {
        const view = self.viewSignature
        return view === undefined
          ? undefined
          : { view, settings: self.settingsFetchInputs }
      })
      return {
        /**
         * #getter
         * The key of the fetch the current view, settings and adapter call
         * for: captured at issue and stamped at commit. Its identity survives
         * a recomputation onto equal content.
         */
        get currentFetchKey(): FetchKey | undefined {
          return key.get()
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * The held data was committed for the current key and the display is
       * not about to supersede it. For readers outside the fetch, the export
       * gate above all; the fetch autorun makes the same compare inside
       * `installFetch`, where a reload can override it.
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
         * The commit half of a keyed fetch: the display's store and the key
         * stamp in one transaction, so no observer sees fresh data under a
         * stale key or the reverse.
         */
        commitFetchResult(commit: () => void, key: FetchKey) {
          commit()
          self.loadedFetchKey = key
        },
        /**
         * #action
         * `FetchMixin.reload`, whose counter bump overrides the skeleton's
         * freshness gate, plus dropping the loaded key so an export started
         * after the click waits for the refetch. The data stays on screen.
         */
        reload() {
          superReload()
          self.loadedFetchKey = undefined
        },
      }
    })
}

export type KeyedFetchMixinType = ReturnType<typeof KeyedFetchMixin>
