import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  calcRegionCombinedOffsets,
  calcRegionDataXStarts,
} from '../regionOffsets.ts'

import type { HicDataResult, RenderHicDataArgs } from './types.ts'
import type HicAdapter from '../HicAdapter/HicAdapter.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function executeRenderHicData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderHicDataArgs
}): Promise<HicDataResult> {
  const {
    sessionId,
    adapterConfig,
    regions,
    bpPerPx,
    resolution,
    normalization,
    stopToken,
    statusCallback,
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as HicAdapter

  const { records: features, resolution: res } =
    await adapter.getMultiRegionContactRecords(regions, {
      resolution,
      normalization,
      stopToken,
      statusCallback,
    })

  // the fetch may have completed after the user navigated away; bail before
  // the O(numContacts) buffer build + sort rather than doing throwaway work
  checkStopToken(stopToken)

  const w = res / (bpPerPx * Math.SQRT2)
  const regionCombinedOffsets = calcRegionCombinedOffsets(regions, bpPerPx, res)
  const regionDataXStarts = calcRegionDataXStarts(regions, bpPerPx)
  const numContacts = features.length

  const positions = new Float32Array(numContacts * 2)
  const counts = new Float32Array(numContacts)
  const contactBin1 = new Uint32Array(numContacts)
  const contactBin2 = new Uint32Array(numContacts)
  const contactRegion1 = new Uint16Array(numContacts)
  const contactRegion2 = new Uint16Array(numContacts)

  for (let i = 0; i < numContacts; i++) {
    const { bin1, bin2, counts: c, region1Idx, region2Idx } = features[i]!
    positions[i * 2] = (bin1 + regionCombinedOffsets[region1Idx]!) * w
    positions[i * 2 + 1] = (bin2 + regionCombinedOffsets[region2Idx]!) * w
    counts[i] = c
    contactBin1[i] = bin1
    contactBin2[i] = bin2
    contactRegion1[i] = region1Idx
    contactRegion2[i] = region2Idx
  }

  // Sort a Float32Array copy of `counts` once and read both maxScore and the
  // 95th percentile off it. Avoids a separate max-scan plus an Array<number>
  // sort (Float32Array.sort is significantly faster).
  let maxScore = 0
  let percentile95 = 0
  if (numContacts > 0) {
    const sorted = new Float32Array(counts)
    sorted.sort()
    maxScore = sorted[numContacts - 1]!
    percentile95 = sorted[Math.floor(0.95 * (numContacts - 1))]!
  }

  const result: HicDataResult = {
    positions,
    counts,
    numContacts,
    maxScore,
    percentile95,
    binWidth: w,
    resolution: res,
    regionRefNames: regions.map(r => r.refName),
    contactBin1,
    contactBin2,
    contactRegion1,
    contactRegion2,
    regionDataXStarts,
    regionCombinedOffsets,
  }
  // Move the per-contact buffers zero-copy instead of structured-cloning them.
  return rpcResult(result, [
    positions.buffer,
    counts.buffer,
    contactBin1.buffer,
    contactBin2.buffer,
    contactRegion1.buffer,
    contactRegion2.buffer,
  ]) as unknown as HicDataResult
}
