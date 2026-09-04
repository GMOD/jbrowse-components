import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'

import { AUTO_PARTITION_FIELD } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

import type { MultiRowGetFeaturesArgs } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { FetchEachRegionModel } from '@jbrowse/display-kit/fetchEachRegion'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'

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
  needed: IndexedRegion[],
) {
  const args = rpcArgs(self)
  // An empty slot means "resolve it from the data", which the worker does off a
  // sample of the region it packs — so a region loaded later can pick a
  // different attribute than the ones on screen. Once a region with features in
  // it has answered, later ones are told the answer (`pinnedPartitionField`).
  //
  // Read once, before a fan-out that is parallel: the regions of the FIRST
  // batch are all told auto and each resolves on its own, so the pin is not
  // what keeps them together. `regionHasData` is — a region that answered
  // something other than the pin reads as holding nothing and is refetched with
  // the field spelled out.
  const partitionField =
    args.partitionField === AUTO_PARTITION_FIELD
      ? self.pinnedPartitionField
      : args.partitionField
  return fetchEachRegion(self, needed, {
    call: (region, ctx) =>
      ctx.callRpc('MultiRowGetFeatures', {
        ...args,
        region,
        partitionField,
      }),
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
}
