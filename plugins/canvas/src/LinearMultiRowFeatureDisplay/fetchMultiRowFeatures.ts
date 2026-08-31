import { fetchEachRegion } from '@jbrowse/display-kit/MultiRegionDisplayMixin'

import { AUTO_PARTITION_FIELD } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

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
  pinnedPartitionField: string
  resolvedByteLimit: () => number | undefined
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
}

export function fetchMultiRowFeatures(
  self: FetchSelf,
  needed: { region: Region; displayedRegionIndex: number }[],
) {
  const byteLimit = self.resolvedByteLimit()
  const props = self.rpcProps()
  // An empty slot means "resolve it from the data", which the worker does off a
  // sample of the region it packs — so a region loaded later can pick a
  // different attribute than the ones on screen. Once a region has answered,
  // later ones are told the answer. See `pinnedPartitionField`.
  const partitionField =
    props.partitionField === AUTO_PARTITION_FIELD
      ? self.pinnedPartitionField
      : props.partitionField
  return fetchEachRegion(self, needed, {
    call: (region, ctx) =>
      ctx.callRpc('MultiRowGetFeatures', {
        adapterConfig: self.adapterConfig,
        region,
        byteLimit,
        ...props,
        partitionField,
      }),
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
}
