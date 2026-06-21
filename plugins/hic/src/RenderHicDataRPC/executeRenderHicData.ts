import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import {
  calcRegionCombinedOffsets,
  calcRegionDataXStarts,
  contactLookupKey,
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
  } = args

  // The display's afterAttach autorun gates fetches on
  // `effectiveResolution !== undefined`, so this only fires on programming
  // errors (e.g. a third-party caller invoking the RPC directly).
  if (resolution === undefined) {
    throw new Error('RenderHicData: resolution is required')
  }

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
    })

  const w = res / (bpPerPx * Math.SQRT2)
  const regionCombinedOffsets = calcRegionCombinedOffsets(regions, bpPerPx, res)
  const regionDataXStarts = calcRegionDataXStarts(regions, bpPerPx)
  const numContacts = features.length

  const positions = new Float32Array(numContacts * 2)
  const counts = new Float32Array(numContacts)
  const lookup: Record<string, number> = {}

  for (let i = 0; i < numContacts; i++) {
    const { bin1, bin2, counts: c, region1Idx, region2Idx } = features[i]!
    positions[i * 2] = (bin1 + regionCombinedOffsets[region1Idx]!) * w
    positions[i * 2 + 1] = (bin2 + regionCombinedOffsets[region2Idx]!) * w
    counts[i] = c
    lookup[contactLookupKey(region1Idx, region2Idx, bin1, bin2)] = i
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
    percentile95 =
      sorted[Math.min(Math.floor(0.95 * numContacts), numContacts - 1)]!
  }

  return {
    positions,
    counts,
    numContacts,
    maxScore,
    percentile95,
    binWidth: w,
    resolution: res,
    regionRefNames: regions.map(r => r.refName),
    lookup,
    regionDataXStarts,
    regionCombinedOffsets,
  }
}
