import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'

import { AUTO_PARTITION_FIELD } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

import type { MultiRowGetFeaturesArgs } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
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
}

export function fetchMultiRowFeatures(
  self: FetchSelf,
  needed: IndexedRegion[],
) {
  const args = rpcArgs(self)
  // An empty slot means "resolve it from the data", which the worker does off a
  // sample of the region it packs, so regions loaded later could pick a
  // different attribute; once one region with features has answered,
  // `pinnedPartitionField` tells the rest what it resolved to.
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
    onResult: (_idx, result) => result,
  })
}
