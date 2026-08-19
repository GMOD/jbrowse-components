import { isDataCurrent } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  GlobalFetchMixin,
  foundationDisplayStatusPhase,
} from '@jbrowse/plugin-linear-genome-view'

import { currentRegionSignature } from './regionSignature.ts'

import type { Feature } from '@jbrowse/core/util'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

/**
 * Shared fetch/gating model for both arc displays. Composes the
 * rendering-agnostic `GlobalFetchMixin` (cancel-safe `runFetch`, region-too-large
 * gate, `reload`/`reloadCounter`, `svgReady`) and adds the arc-specific data
 * state (`features` + its region signature) plus a **derived** `regionTooLarge`
 * — the exact byte-only pattern LD and multi-sample variant use, so arc has no
 * special region-too-large handling: the banner is a pure function of the last
 * measurement, and what keeps that measurement describing the viewport on screen
 * is that a blocked display keeps running this fetch once per settled viewport,
 * stopping at the pre-flight. No imperative clear, and no derived second byte
 * number scaled by span — see RegionTooLargeMixin §"Measurement follows the
 * viewport".
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
        get measuresBytesPreFlight() {
          return true
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The box the arcs are laid out in: the on-screen `<svg>` and the
         * export's clip rect have to be one number, or a bezier that legitimately
         * bows outside the viewport is clipped on one path and not the other.
         * Same name and same reason as the LD display's, over `totalWidthPx`
         * because arcs span the whole scrolled content rather than the content
         * width alone.
         *
         * Not the `canvasWidth` an SVG body gets from `renderDisplaySvg`, which
         * is the viewport width the shell paints at — see `renderArcSvg`.
         */
        get canvasWidth() {
          return self.lgv.totalWidthPx
        },
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
          // no spatial-staleness axis: stale arcs stay on screen under the
          // overlay through a refetch rather than blanking (see `reload`). That
          // argument is the only thing arc supplies — every term is read off
          // `self` by the same mapping the two GPU foundations use, so a term
          // added to `computeLoadingTerm` reaches this display too. Arc spelled
          // the object out by hand until it was the last one doing so.
          return foundationDisplayStatusPhase(self, () => true)
        },

        /**
         * #getter
         * Arc's first-paint signal — the `canvasDrawn` analogue for a display
         * that paints main-thread SVG and composes no `RenderLifecycleMixin`.
         * Stays true across a refetch so `data-display-drawn` and the loading
         * anti-flash don't churn on pan; the stricter, staleness-aware
         * `svgReady` is the export gate.
         *
         * On the model rather than derived in `BaseDisplayComponent`, for the
         * same reason `displayPhase` is: a component-side derivation is free to
         * disagree with what the model believes, and this one feeds an
         * attribute (`data-display-drawn`) that the screenshot and browser
         * harnesses wait on.
         */
        get painted(): boolean {
          return self.features !== undefined || !!self.error
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
