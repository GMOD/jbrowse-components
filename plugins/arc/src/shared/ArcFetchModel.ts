import { getContainingView, isDataCurrent } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  GlobalFetchMixin,
  evaluateRegionTooLarge,
  resolveByteLimit,
  scaleByteEstimate,
  scaledForceLoadByteLimit,
} from '@jbrowse/plugin-linear-genome-view'

import { currentRegionSignature } from './regionSignature.ts'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  return types
    .compose('ArcFetchModel', GlobalFetchMixin(), types.model({}))
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Feature[] | undefined,
      /**
       * #volatile
       * signature of the static-block region set `features` were fetched for;
       * the `dataLoaded`/`svgReady` freshness axis (see regionSignature.ts)
       */
      loadedRegionSignature: undefined as string | undefined,
      /**
       * #volatile
       * visibleBp when the current `featureDensityStats` estimate was captured,
       * so the derived `regionTooLarge` getter can scale it to the current view
       */
      byteEstimateVisibleBp: undefined as number | undefined,
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
    .actions(self => {
      const superSetFeatureDensityStats = self.setFeatureDensityStats
      return {
        /**
         * #action
         * Records the span the byte estimate was measured at so
         * `estimatedVisibleBytes` can scale it to the current view.
         */
        setFeatureDensityStats(
          stats?: Parameters<typeof superSetFeatureDensityStats>[0],
        ) {
          self.byteEstimateVisibleBp = stats
            ? (getContainingView(self) as LinearGenomeViewModel).visibleBp
            : undefined
          superSetFeatureDensityStats(stats)
        },
      }
    })
    .views(() => ({
      /**
       * #getter
       * Overridable hook: the display's configured `fetchSizeLimit`. The mixin
       * can't read a config slot itself (it owns no `configuration`), so each
       * concrete arc model supplies `getConf(self, 'fetchSizeLimit')`. Default
       * matches the BaseLinearDisplay slot default; every arc model overrides it.
       */
      get configuredFetchSizeLimit(): number {
        return 1_000_000
      },
    }))
    .views(self => ({
      /**
       * #getter
       * cached byte estimate scaled from the span it was measured over to the
       * current visible span, so the verdict self-releases on zoom-in
       */
      get estimatedVisibleBytes() {
        return scaleByteEstimate({
          bytes: self.featureDensityStats?.bytes,
          captureBp: self.byteEstimateVisibleBp,
          visibleBp: (getContainingView(self) as LinearGenomeViewModel).visibleBp,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit),
       * fed the scaled estimate — same helper as every other gating path
       */
      get tooLargeStatus() {
        return evaluateRegionTooLarge({
          visibleBp: (getContainingView(self) as LinearGenomeViewModel).visibleBp,
          bytes: self.estimatedVisibleBytes,
          byteLimit: resolveByteLimit({
            userByteSizeLimit: self.userByteSizeLimit,
            adapterFetchSizeLimit: self.featureDensityStats?.fetchSizeLimit,
            configFetchSizeLimit: self.configuredFetchSizeLimit,
          }),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * derived — shadows GlobalFetchMixin's imperative RegionTooLargeMixin getter
       */
      get regionTooLarge() {
        return self.tooLargeStatus.tooLarge
      },
      /**
       * #getter
       */
      get regionTooLargeReason() {
        return self.tooLargeStatus.reason
      },
      /**
       * #getter
       * fresh only when `features` were fetched for the current static-block set;
       * overrides GlobalFetchMixin's default so `svgReady` can resolve on load
       */
      get dataLoaded() {
        return isDataCurrent(
          self.loadedRegionSignature,
          currentRegionSignature(self),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Force-load raises the byte gate past the estimate scaled to the *current*
       * view (shared helper), not the raw captured bytes, so it clears even if the
       * view zoomed out after the estimate was captured.
       */
      setFeatureDensityStatsLimit(stats?: { bytes?: number }) {
        const limit = scaledForceLoadByteLimit({
          scaledEstimate: self.estimatedVisibleBytes,
          rawBytes: stats?.bytes,
        })
        if (limit !== undefined) {
          self.userByteSizeLimit = limit
        }
      },
    }))
}

export type ArcFetchModelType = ReturnType<typeof ArcFetchModel>
