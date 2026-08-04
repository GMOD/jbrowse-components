import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  calcRegionCombinedOffsets,
  calcRegionDataXBounds,
} from '../regionOffsets.ts'
import { computeCountStats } from './countStats.ts'

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
    regionOffsetsPx,
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

  const {
    bin1: contactBin1,
    bin2: contactBin2,
    counts,
    pairs,
    numContacts,
    resolution: res,
    appliedNormalization,
  } = await adapter.getMultiRegionContactRecords(regions, {
    resolution,
    normalization,
    stopToken,
    statusCallback,
  })

  // the fetch may have completed after the user navigated away; bail before
  // the O(numContacts) buffer build + sort rather than doing throwaway work
  checkStopToken(stopToken)

  const w = res / (bpPerPx * Math.SQRT2)
  const regionCombinedOffsets = calcRegionCombinedOffsets(
    regions,
    regionOffsetsPx,
    bpPerPx,
    res,
  )
  const regionDataXBounds = calcRegionDataXBounds(
    regions,
    regionOffsetsPx,
    bpPerPx,
  )
  const regionReversed = regions.map(r => !!r.reversed)

  // `contactBin1`/`contactBin2`/`counts` arrive from the adapter already in
  // their final layout and are forwarded untouched — only the projected
  // positions and the region columns are built here.
  const positions = new Float32Array(numContacts * 2)
  const contactRegion1 = new Uint16Array(numContacts)
  const contactRegion2 = new Uint16Array(numContacts)

  for (const { region1Idx, region2Idx, start, end } of pairs) {
    // Region membership is constant across the run, so it is filled rather
    // than assigned per contact.
    contactRegion1.fill(region1Idx, start, end)
    contactRegion2.fill(region2Idx, start, end)

    // Every layout term below is pair-invariant, so it resolves once per run
    // instead of once per contact — four indexed loads and two unpredictable
    // branches that used to sit in the inner loop purely because region
    // membership was stored per contact.
    const off1 = regionCombinedOffsets[region1Idx]!
    const off2 = regionCombinedOffsets[region2Idx]!
    const rev1 = regionReversed[region1Idx]!
    const rev2 = regionReversed[region2Idx]!
    // A cell spans `[u, u+w]`, so its reflection's *min* corner is
    // `mirrorUInRegion(u) - w`, which folds to `mirrorBase - u`.
    const mirrorBase1 =
      regionDataXBounds[region1Idx * 2]! +
      regionDataXBounds[region1Idx * 2 + 1]! -
      w
    const mirrorBase2 =
      regionDataXBounds[region2Idx * 2]! +
      regionDataXBounds[region2Idx * 2 + 1]! -
      w

    for (let i = start; i < end; i++) {
      const u1 = (contactBin1[i]! + off1) * w
      const u2 = (contactBin2[i]! + off2) * w
      // Reflect each endpoint inside its own reversed region.
      const m1 = rev1 ? mirrorBase1 - u1 : u1
      const m2 = rev2 ? mirrorBase2 - u2 : u2
      // Renderers draw the triangle above the axis only for `u1 ≤ u2` (a lower
      // pair rotates to a negative y). Reflecting a region flips the order of
      // contacts *within* it, so re-canonicalize — legal because the matrix is
      // symmetric, `contact(a,b) === contact(b,a)`. Cross-region pairs can't
      // invert (each stays in its own region), so this only fires when both
      // endpoints share one reversed region.
      positions[i * 2] = Math.min(m1, m2)
      positions[i * 2 + 1] = Math.max(m1, m2)
    }
  }

  const { maxScore, percentile95 } = computeCountStats(counts, numContacts)

  const result: HicDataResult = {
    positions,
    counts,
    numContacts,
    maxScore,
    percentile95,
    binWidth: w,
    resolution: res,
    appliedNormalization,
    regionRefNames: regions.map(r => r.refName),
    contactBin1,
    contactBin2,
    contactRegion1,
    contactRegion2,
    regionDataXBounds,
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
