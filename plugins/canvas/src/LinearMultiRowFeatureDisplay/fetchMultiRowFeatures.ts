import { fetchEachRegion } from '@jbrowse/display-kit/MultiRegionDisplayMixin'

import type { MultiRowGetFeaturesArgs } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { FetchEachRegionModel } from '@jbrowse/display-kit/MultiRegionDisplayMixin'

interface FetchSelf extends FetchEachRegionModel {
  adapterConfig: Record<string, unknown>
  rpcProps: () => Pick<
    MultiRowGetFeaturesArgs,
    'partitionField' | 'lengthField' | 'colorConfig'
  >
  resolvedByteLimit: () => number | undefined
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
}

export function fetchMultiRowFeatures(
  self: FetchSelf,
  needed: { region: Region; displayedRegionIndex: number }[],
) {
  const byteLimit = self.resolvedByteLimit()
  return fetchEachRegion(self, needed, {
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
