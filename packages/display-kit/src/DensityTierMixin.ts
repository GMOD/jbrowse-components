import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { types } from '@jbrowse/mobx-state-tree'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'

import {
  densityBinsCover,
  densityZoomBucket,
  isDensityTierMode,
  resolveDensityTier,
  resolveFetchSuspended,
} from './densityTier.ts'
import { onDisplayedRegionsChange } from './displayAutoruns.ts'

import type { DensityTierConfigModel } from './densityTierConfigSchemaFields.ts'
import type { BufferedVisibleRegion, RegionHost } from './regionHost.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { StatusWindow } from '@jbrowse/core/util/progress'

/**
 * What `DensityTierMixin` reads off its host: the two slots, the gate's verdict
 * and adapter hooks from `RegionTooLargeMixin`, and the fetch skeleton's terms
 * from `FetchMixin` and `BaseDisplay`.
 */
export interface DensityTierHost extends FetchSkeletonHost {
  configuration: DensityTierConfigModel
  regionTooLarge: boolean
  setError: (error?: unknown) => void
  byteGateAdapterPath: string[]
  byteGateAdapterConfig: Record<string, unknown>
  isMinimized: boolean
  statusWindow: StatusWindow
}

function host(self: object) {
  return self as DensityTierHost
}

function view(self: object) {
  return getContainingView(self) as RegionHost
}

interface DensityIssue {
  regions: BufferedVisibleRegion[]
  bpPerPx: number
  adapterConfig: Record<string, unknown>
}

function densityIssueKey({ regions, bpPerPx, adapterConfig }: DensityIssue) {
  const regionKey = regions
    .map(
      ({ region: r, displayedRegionIndex }) =>
        `${displayedRegionIndex}:${r.refName}:${Math.floor(r.start)}-${Math.ceil(r.end)}`,
    )
    .join(',')
  return `${densityZoomBucket(bpPerPx)}|${regionKey}|${JSON.stringify(adapterConfig)}`
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
       * The issue key of the bins held, which the read compares against.
       */
      densityBinsKey: undefined as string | undefined,
      /**
       * #volatile
       * What the held bins were read over: the buffered regions, the zoom
       * bucket and the adapter, so a pan or a zoom inside them re-reads
       * nothing.
       */
      densityBinsRead: undefined as
        | {
            regions: BufferedVisibleRegion[]
            bucket: number
            adapterKey: string
          }
        | undefined,
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
        const conf = self.densitySourceConfig
        return typeof conf === 'object' && conf !== null
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
       * `FetchMixin`'s hook, from `resolveFetchSuspended` over the tier's
       * verdict. A display whose band needs somewhere to draw (alignments,
       * whose coverage band can be hidden) overrides it with that term.
       */
      get fetchSuspended() {
        return resolveFetchSuspended({
          standsIn: self.densityTierActive,
          mode: self.densityTierMode,
          regionTooLarge: host(self).regionTooLarge,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setDensityBins(
        entries: { displayedRegionIndex: number; bins: FeatureDensity }[],
        key: string,
        read?: {
          regions: BufferedVisibleRegion[]
          bucket: number
          adapterKey: string
        },
      ) {
        self.densityBins.clear()
        for (const { displayedRegionIndex, bins } of entries) {
          self.densityBins.set(displayedRegionIndex, bins)
        }
        self.densityBinsKey = key
        self.densityBinsRead = read
      },
      /**
       * #action
       */
      clearDensityBins() {
        self.densityBins.clear()
        self.densityBinsKey = undefined
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
          // nothing to read while the held bins still cover the screen at
          // this zoom bucket for this adapter, so a pan or a small zoom
          // inside the buffered read draws what is held
          prepare: () => {
            const v = view(self)
            const adapterConfig = host(self).byteGateAdapterConfig
            const read = self.densityBinsRead
            const covered =
              read !== undefined &&
              read.bucket === densityZoomBucket(v.coarseBpPerPx) &&
              read.adapterKey === JSON.stringify(adapterConfig) &&
              densityBinsCover(read.regions, v.visibleRegions)
            return v.initialized && !covered
              ? {
                  regions: v.bufferedVisibleRegions,
                  bpPerPx: v.coarseBpPerPx,
                  adapterConfig,
                }
              : undefined
          },
          fetchKey: densityIssueKey,
          committedKey: () => self.densityBinsKey,
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
              densityIssueKey(issue),
              {
                regions: issue.regions,
                bucket: densityZoomBucket(issue.bpPerPx),
                adapterKey: JSON.stringify(issue.adapterConfig),
              },
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
