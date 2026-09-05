import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import CoarseTierMixin from './CoarseTierMixin.ts'
import {
  coarseTierModeOf,
  densityZoomBucket,
  isDensityTierMode,
} from './densityTier.ts'

import type { CoarseTierRead, CoarseTierResult } from './coarseTier.ts'
import type { DensityTierConfigModel } from './densityTierConfigSchemaFields.ts'
import type { RegionHost } from './regionHost.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'

interface DensityTierHost {
  configuration: DensityTierConfigModel
  byteGateAdapterConfig: Record<string, unknown>
}

function host(self: object) {
  return self as DensityTierHost
}

function view(self: object) {
  return getContainingView(self) as RegionHost
}

/**
 * The density tier: `CoarseTierMixin` with the adapter's `densityAdapter`
 * sidecar as the source, the two slots as the mode and the threshold, the zoom
 * bucket as the read key and `CoreGetFeatureDensity` as the read. Where the
 * region-too-large gate refuses the features, a display with a density source
 * draws features per bin in the banner's place; the display decides how the
 * bins are drawn.
 *
 * #stateModel DensityTierMixin
 * #category display
 */
export default function DensityTierMixin() {
  return types
    .compose(
      'DensityTierMixin',
      CoarseTierMixin<FeatureDensity>(),
      types.model({}),
    )
    .views(self => ({
      /**
       * #getter
       */
      get coarseAdapterSlot() {
        return 'densityAdapter'
      },
      /**
       * #getter
       * The `densityTier` slot's value.
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
      get coarseTierMode() {
        return coarseTierModeOf(self.densityTierMode)
      },
      /**
       * #getter
       * `auto` also swaps from the `densityTierBpPerPx` slot outward, where a
       * track asks for the band before the region is too large to fetch.
       */
      get coarseTierPastThreshold() {
        const threshold = self.densityTierThresholdBpPerPx
        const v = view(self)
        return threshold > 0 && v.initialized && v.coarseBpPerPx >= threshold
      },
      /**
       * #getter
       * The bins are read at the view's bp/px, so a real zoom re-reads at the
       * level the sidecar keeps for it and a small one reuses what is held.
       */
      get coarseReadKey() {
        const v = view(self)
        return v.initialized ? String(densityZoomBucket(v.coarseBpPerPx)) : ''
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async fetchCoarseTier(
        read: CoarseTierRead,
        ctx: FetchContext,
      ): Promise<CoarseTierResult<FeatureDensity>> {
        const result = await ctx.callRpc('CoreGetFeatureDensity', {
          adapterConfig: host(self).byteGateAdapterConfig,
          regions: read.regions.map(r => r.region),
          bpPerPx: view(self).coarseBpPerPx,
        })
        return {
          entries: read.regions.flatMap(({ displayedRegionIndex }, i) => {
            const payload = result?.[i]
            return payload ? [{ displayedRegionIndex, payload }] : []
          }),
        }
      },
    }))
}
