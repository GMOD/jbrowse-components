import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  calcRegionCombinedOffsets,
  calcRegionDataXStarts,
  mirrorUInRegion,
} from '../regionOffsets.ts'

import type HicAdapter from '../HicAdapter/HicAdapter.ts'
import type { HicDataResult, RenderHicDataArgs } from './types.ts'
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
  const regionReversed = regions.map(r => !!r.reversed)

  const positions = new Float32Array(numContacts * 2)
  const counts = new Float32Array(numContacts)
  const contactBin1 = new Uint32Array(numContacts)
  const contactBin2 = new Uint32Array(numContacts)
  const contactRegion1 = new Uint16Array(numContacts)
  const contactRegion2 = new Uint16Array(numContacts)

  for (let i = 0; i < numContacts; i++) {
    const { bin1, bin2, counts: c, region1Idx, region2Idx } = features[i]!
    const u1 = (bin1 + regionCombinedOffsets[region1Idx]!) * w
    const u2 = (bin2 + regionCombinedOffsets[region2Idx]!) * w
    // Reflect each endpoint inside its own reversed region. A cell spans
    // `[u, u+w]`, so its reflected *min* corner is `mirror(u) - w`.
    const m1 = regionReversed[region1Idx]
      ? mirrorUInRegion(regionDataXStarts, region1Idx, u1) - w
      : u1
    const m2 = regionReversed[region2Idx]
      ? mirrorUInRegion(regionDataXStarts, region2Idx, u2) - w
      : u2
    // Renderers draw the triangle above the axis only for `u1 ≤ u2` (a lower
    // pair rotates to a negative y). Reflecting a region flips the order of
    // contacts *within* it, so re-canonicalize — legal because the matrix is
    // symmetric, `contact(a,b) === contact(b,a)`. Cross-region pairs can't
    // invert (each stays in its own region), so this only fires when both
    // endpoints share one reversed region.
    positions[i * 2] = Math.min(m1, m2)
    positions[i * 2 + 1] = Math.max(m1, m2)
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
    regionReversed,
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
