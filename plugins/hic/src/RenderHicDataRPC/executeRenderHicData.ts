import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import {
  calcRegionCombinedOffsets,
  computePercentile,
} from '../regionOffsets.ts'

import type {
  HicContactItem,
  HicDataResult,
  RenderHicDataArgs,
} from './types.ts'
import type HicAdapter from '../HicAdapter/HicAdapter.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'

function calcRegionPixelStarts(regions: Region[], bpPerPx: number) {
  const out = [0]
  let cum = 0
  for (const region of regions) {
    cum += (region.end - region.start) / bpPerPx
    out.push(cum)
  }
  return out
}

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

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as unknown as HicAdapter

  const { records: features, resolution: res } =
    await adapter.getMultiRegionContactRecords(regions, {
      resolution,
      normalization,
      bpPerPx,
    })

  const w = res / (bpPerPx * Math.SQRT2)
  const regionCombinedOffsets = calcRegionCombinedOffsets(regions, bpPerPx, res)
  const regionPixelStarts = calcRegionPixelStarts(regions, bpPerPx)

  if (!features.length) {
    return {
      positions: new Float32Array(0),
      counts: new Float32Array(0),
      numContacts: 0,
      maxScore: 0,
      percentile95: 0,
      binWidth: w,
      items: [],
      lookup: {},
      regionPixelStarts,
      regionCombinedOffsets,
    }
  }

  let maxScore = 0
  for (const f of features) {
    if (f.counts > maxScore) {
      maxScore = f.counts
    }
  }
  const percentile95 = computePercentile(features, 95)

  const positions = new Float32Array(features.length * 2)
  const countValues = new Float32Array(features.length)
  const items: HicContactItem[] = []
  const lookup: Record<string, number> = {}

  for (let i = 0; i < features.length; i++) {
    const { bin1, bin2, counts, region1Idx, region2Idx } = features[i]!

    const x = (bin1 + regionCombinedOffsets[region1Idx]!) * w
    const y = (bin2 + regionCombinedOffsets[region2Idx]!) * w

    positions[i * 2] = x
    positions[i * 2 + 1] = y
    countValues[i] = counts

    items.push({ bin1, bin2, counts, region1Idx, region2Idx })
    lookup[`${region1Idx}|${region2Idx}|${bin1}|${bin2}`] = i
  }

  return {
    positions,
    counts: countValues,
    numContacts: features.length,
    maxScore,
    percentile95,
    binWidth: w,
    items,
    lookup,
    regionPixelStarts,
    regionCombinedOffsets,
  }
}
