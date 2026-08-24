import { fetchGatedRegions } from '../shared/fetchGatedRegions.ts'

import type { MultiRowGetFeaturesArgs } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { RegionGateMeasurement } from '../shared/CanvasFeatureGateMixin.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { FetchEachRegionModel } from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import type { GateFetchState } from '@jbrowse/display-kit/regionTooLargeUtils'

interface FetchSelf extends FetchEachRegionModel {
  adapterConfig: Record<string, unknown>
  rpcProps: () => Pick<
    MultiRowGetFeaturesArgs,
    'partitionField' | 'lengthField' | 'colorConfig'
  >
  resolvedByteLimit: () => number | undefined
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
  gateFetchState: () => GateFetchState
  commitGateMeasurements: (
    measurements: RegionGateMeasurement[],
    issued: GateFetchState,
  ) => void
}

export function fetchMultiRowFeatures(
  self: FetchSelf,
  needed: { region: Region; displayedRegionIndex: number }[],
) {
  const byteLimit = self.resolvedByteLimit()
  return fetchGatedRegions(self, needed, {
    call: (region, ctx) =>
      ctx.callRpc('MultiRowGetFeatures', {
        adapterConfig: self.adapterConfig,
        region,
        byteLimit,
        ...self.rpcProps(),
      }),
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
}
