import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { isDensitySourceConfig } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'
import { adapterConfigKey } from '@jbrowse/core/util/adapterConfigKey'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { types } from '@jbrowse/mobx-state-tree'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'

import {
  densityBandDisplayPhase,
  densityBandSvgReady,
} from './densityBandPhase.ts'
import {
  densityBinsCover,
  densityZoomBucket,
  isDensityTierMode,
  resolveDensityTier,
  resolveFetchSuspended,
} from './densityTier.ts'
import { onDisplayedRegionsChange } from './displayAutoruns.ts'

import type { DensityBandPhaseHost } from './densityBandPhase.ts'
import type { DensityTierConfigModel } from './densityTierConfigSchemaFields.ts'
import type { BufferedVisibleRegion, RegionHost } from './regionHost.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { StatusWindow } from '@jbrowse/core/util/progress'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What `DensityTierMixin` reads off its host: the two slots, the gate's verdict
 * and adapter hooks from `RegionTooLargeMixin`, the fetch skeleton's terms from
 * `FetchMixin` and `BaseDisplay`, and the phase foundation the band's own
 * phase post-processes.
 */
export interface DensityTierHost
  extends
    Omit<FetchSkeletonHost, 'fetchCanceled'>,
    Omit<
      DensityBandPhaseHost,
      'densityBinsRead' | 'densityLoading' | 'densityBandActive'
    > {
  configuration: DensityTierConfigModel
  setError: (error?: unknown) => void
  byteGateAdapterPath: string[]
  byteGateAdapterConfig: Record<string, unknown>
  isMinimized: boolean
  statusWindow: StatusWindow
}

function host(self: object) {
  return self as DensityTierHost
}

function bandPhaseHost(self: object) {
  return self as DensityBandPhaseHost
}

function view(self: object) {
  return getContainingView(self) as RegionHost
}

interface DensityIssue {
  regions: BufferedVisibleRegion[]
  bpPerPx: number
  adapterConfig: Record<string, unknown>
}

/** What one read was issued over, and so what the held bins answer for. */
export interface DensityRead {
  regions: BufferedVisibleRegion[]
  bucket: number
  adapterKey: string
}

function densityRead({ regions, bpPerPx, adapterConfig }: DensityIssue) {
  return {
    regions,
    bucket: densityZoomBucket(bpPerPx),
    adapterKey: adapterConfigKey(adapterConfig),
  }
}

/**
 * The density tier: where the region-too-large gate refuses the features, a
 * display with a density source draws features per bin in the banner's place.
 * The verdict stays exactly what `RegionTooLargeMixin` derives — the feature
 * fetch still stops at the gate — and this mixin adds the swap decision, the
 * bins and the small read that fills them, through the shared fetch skeleton
 * on its own rotation so the primary fetch's cancel never reaches it. Composed
 * after `RegionTooLargeMixin`; the display decides how the bins are drawn.
 *
 * #stateModel DensityTierMixin
 * #category display
 */
export default function DensityTierMixin() {
  return types
    .model('DensityTierMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Features per bin by `displayedRegionIndex`, at the zoom bucket the last
       * read was issued for. Cleared on chromosome navigation.
       */
      densityBins: regionDataMap<FeatureDensity>('densityBins'),
      /**
       * #volatile
       * What the held bins were read over: the buffered regions, the zoom
       * bucket and the adapter, so a pan or a zoom inside them re-reads
       * nothing. Undefined until a read lands.
       */
      densityBinsRead: undefined as DensityRead | undefined,
      /**
       * #volatile
       */
      densityLoading: false,
    }))
    .views(self => ({
      /**
       * #getter
       * The `densityAdapter` slot of the adapter the gate measures, read off
       * the live track config so a tiered display's swap follows it.
       */
      get densitySourceConfig(): unknown {
        return readConfObject(getContainingTrack(self).configuration, [
          ...host(self).byteGateAdapterPath,
          'densityAdapter',
        ])
      },
      /**
       * #getter
       */
      get densityTierMode() {
        const mode: unknown = getConf(host(self), 'densityTier')
        return isDensityTierMode(mode) ? mode : 'auto'
      },
      /**
       * #getter
       */
      get densityTierThresholdBpPerPx(): number {
        return getConf(host(self), 'densityTierBpPerPx')
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasDensitySource() {
        return isDensitySourceConfig(self.densitySourceConfig)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the band stands in for features right now.
       */
      get densityTierActive() {
        const v = view(self)
        return resolveDensityTier({
          mode: self.densityTierMode,
          hasSource: self.hasDensitySource,
          regionTooLarge: host(self).regionTooLarge,
          bpPerPx: v.initialized ? v.coarseBpPerPx : undefined,
          thresholdBpPerPx: self.densityTierThresholdBpPerPx,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook (default: the tier's verdict) — whether the band is
       * standing in for the features on screen right now. A display whose band
       * needs somewhere to draw narrows it: canvas adds the view geometry the
       * draw is mapped through, alignments the coverage band that can be
       * hidden.
       */
      get densityBandActive(): boolean {
        return self.densityTierActive
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over
       * `densityBandActive`.
       */
      get fetchSuspended() {
        return resolveFetchSuspended({
          standsIn: self.densityBandActive,
          mode: self.densityTierMode,
          regionTooLarge: host(self).regionTooLarge,
        })
      },
      /**
       * #getter
       * The foundation's phase with the too-large banner swapped for the band —
       * see `densityBandDisplayPhase`. Composed after the foundation, so this
       * getter is the one `types.compose` keeps.
       */
      get displayPhase(): DisplayPhase {
        return densityBandDisplayPhase(bandPhaseHost(self))
      },
      /**
       * #getter
       * The export gate under the same swap — see `densityBandSvgReady`.
       */
      get svgReady(): boolean {
        return densityBandSvgReady(bandPhaseHost(self))
      },
      /**
       * #getter
       * `renderDisplaySvg`'s hook: the export paints the band in place of the
       * too-large note, the same swap the chrome makes on screen. Here rather
       * than beside each display's phase getters, which is where it was and
       * where alignments forgot it — `awaitSvgReady` waited out the bins and
       * `SvgChrome` then wrote the note over them.
       */
      get drawsWhenTooLarge() {
        return self.densityBandActive
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setDensityBins(
        entries: { displayedRegionIndex: number; bins: FeatureDensity }[],
        read: DensityRead,
      ) {
        self.densityBins.clear()
        for (const { displayedRegionIndex, bins } of entries) {
          self.densityBins.set(displayedRegionIndex, bins)
        }
        self.densityBinsRead = read
      },
      /**
       * #action
       */
      clearDensityBins() {
        self.densityBins.clear()
        self.densityBinsRead = undefined
      },
      /**
       * #action
       */
      setDensityLoading(loading: boolean) {
        self.densityLoading = loading
      },
    }))
    .actions(self => ({
      afterAttach() {
        onDisplayedRegionsChange(
          self,
          () => {
            self.clearDensityBins()
          },
          'ClearDensityBinsOnNav',
        )
        installFetch<DensityIssue, FeatureDensity[]>(host(self), {
          name: 'FetchDensityTier',
          delay: 300,
          report: { statusWindow: host(self).statusWindow },
          gate: () => self.densityTierActive && !host(self).isMinimized,
          prepare: () => {
            const v = view(self)
            return v.initialized
              ? {
                  regions: v.bufferedVisibleRegions,
                  bpPerPx: v.coarseBpPerPx,
                  adapterConfig: host(self).byteGateAdapterConfig,
                }
              : undefined
          },
          // Nothing to read while the held bins still cover the screen at this
          // zoom bucket for this adapter, so a pan or a small zoom inside the
          // buffered read draws what is held. The skeleton's freshness gate in
          // its predicate form, because "the read contains the viewport" is not
          // a key equality — and there rather than in `prepare`, so a Retry
          // overrides it the way it overrides every other freshness gate.
          heldAnswers: issue => {
            const read = self.densityBinsRead
            const issued = densityRead(issue)
            return (
              read !== undefined &&
              read.bucket === issued.bucket &&
              read.adapterKey === issued.adapterKey &&
              densityBinsCover(read.regions, view(self).visibleRegions)
            )
          },
          run: (issue, ctx) =>
            ctx.callRpc('CoreGetFeatureDensity', {
              adapterConfig: issue.adapterConfig,
              regions: issue.regions.map(r => r.region),
              bpPerPx: issue.bpPerPx,
            }),
          commit: (result, issue) => {
            self.setDensityBins(
              issue.regions.flatMap(({ displayedRegionIndex }, i) => {
                const bins = result[i]
                return bins ? [{ displayedRegionIndex, bins }] : []
              }),
              densityRead(issue),
            )
          },
          // the display's own error, so the banner and its Retry are the ones
          // the reads already have
          setError: error => {
            host(self).setError(error)
          },
          onBegin: () => {
            self.setDensityLoading(true)
          },
          onEnd: current => {
            if (current) {
              self.setDensityLoading(false)
            }
          },
        })
      },
    }))
}
