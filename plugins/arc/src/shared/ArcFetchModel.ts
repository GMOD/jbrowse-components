import { isDataCurrent } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  GlobalFetchMixin,
  computeDisplayStatusPhase,
} from '@jbrowse/plugin-linear-genome-view'

import { currentRegionSignature } from './regionSignature.ts'

import type { Feature } from '@jbrowse/core/util'
import type { DisplayStatusPhase } from '@jbrowse/plugin-linear-genome-view'

/**
 * Shared fetch/gating model for both arc displays. Composes the
 * rendering-agnostic `GlobalFetchMixin` (cancel-safe `runFetch`, region-too-large
 * gate, `reload`/`reloadCounter`, `svgReady`) and adds the arc-specific data
 * state (`features` + its region signature) plus a **derived** `regionTooLarge`
 * — the exact byte-only pattern LinearWiggle/LD/canvas use, so arc has no special
 * region-too-large handling: the banner is a pure function of the cached estimate
 * scaled to the current viewport and self-releases on zoom-in with no imperative
 * clear.
 *
 * #stateModel ArcFetchModel
 * #category display
 */
export function ArcFetchModel() {
  return (
    types
      .compose('ArcFetchModel', GlobalFetchMixin(), types.model({}))
      .volatile(() => ({
        /**
         * #volatile
         */
        features: undefined as Feature[] | undefined,
        /**
         * #volatile
         * signature of the static-block region set `features` were fetched for;
         * the `dataCurrent`/`svgReady` freshness axis (see regionSignature.ts)
         */
        loadedRegionSignature: undefined as string | undefined,
      }))
      .actions(self => ({
        /**
         * #action
         */
        setFeatures(f: Feature[], signature: string) {
          self.features = f
          self.loadedRegionSignature = signature
        },
      }))
      // Opt into RegionTooLargeMixin's shared derived byte gate (self-releases on
      // zoom-in, no flicker on pan): this switch, plus the
      // `byteGateBlocksFetch` call in fetchArcFeatures. afterAttach clears the
      // estimate on chromosome nav. Byte-only — no density axis. The mixin reads
      // `fetchSizeLimit` / `forceLoad` straight off the display config.
      .views(() => ({
        /**
         * #getter
         */
        get byteGateEnabled() {
          return true
        },
      }))
      .views(self => ({
        /**
         * #getter
         * fresh only when `features` were fetched for the current static-block set;
         * overrides GlobalFetchMixin's default so `svgReady` can resolve on load
         */
        get dataCurrent() {
          return isDataCurrent(
            self.loadedRegionSignature,
            currentRegionSignature(self),
          )
        },
        /**
         * #getter
         * The same mutually-exclusive visual state every GPU display exposes,
         * over the same shared ranking — arc just has no `renderError` phase,
         * having no GPU backend, which is what the `Status` variant expresses:
         * the type cannot name that phase, so `DisplayStatusChrome` (whose
         * banners have no backend `retry()` to offer) accepts this display with
         * neither a cast nor a dead branch. On the model rather than derived
         * inside `BaseDisplayComponent` so the component can't disagree with the
         * model, and so arc publishes `data-display-phase` for tests like every
         * other display.
         *
         * `isLoadingOrCanceled`, never a bare `isLoading` — see that getter.
         */
        get displayPhase(): DisplayStatusPhase {
          return computeDisplayStatusPhase(self, () => self.isLoadingOrCanceled)
        },
      }))
      .actions(self => {
        const superReload = self.reload
        return {
          /**
           * #action
           * Arc's fetch trigger gates on `!dataCurrent`, so bumping
           * `reloadCounter` alone can't refetch: the signature still matches the
           * current blocks. Drop it so `dataCurrent` goes false and the autorun
           * fires. `features` deliberately survives — the stale arcs stay on
           * screen under the loading overlay rather than blanking, and
           * `setFeatures` replaces them.
           */
          reload() {
            superReload()
            self.loadedRegionSignature = undefined
          },
        }
      })
  )
}

export type ArcFetchModelType = ReturnType<typeof ArcFetchModel>
