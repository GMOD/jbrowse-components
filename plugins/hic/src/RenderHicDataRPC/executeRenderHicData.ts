import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import Flatbush from '@jbrowse/core/util/flatbush'

import {
  calcRegionCombinedOffsets,
  computePercentile,
} from '../regionOffsets.ts'

import type { HicDataResult, HicFlatbushItem } from './types.ts'
import type HicAdapter from '../HicAdapter/HicAdapter.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'

interface RenderHicDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  resolution: number
  normalization: string
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

  if (!features.length) {
    const emptyFlatbush = new Flatbush(1)
    emptyFlatbush.add(0, 0, 0, 0)
    emptyFlatbush.finish()
    return {
      positions: new Float32Array(0),
      counts: new Float32Array(0),
      numContacts: 0,
      colorMaxScore: 0,
      binWidth: w,
      flatbush: emptyFlatbush.data,
      items: [],
    }
  }

  const colorMaxScore = computePercentile(features, 95)

  const positions = new Float32Array(features.length * 2)
  const countValues = new Float32Array(features.length)
  const items: HicFlatbushItem[] = []
  const flatbush = new Flatbush(Math.max(features.length, 1))

  for (const [i, feature] of features.entries()) {
    const { bin1, bin2, counts, region1Idx, region2Idx } = feature

    const x = (bin1 + regionCombinedOffsets[region1Idx]!) * w
    const y = (bin2 + regionCombinedOffsets[region2Idx]!) * w

    positions[i * 2] = x
    positions[i * 2 + 1] = y
    countValues[i] = counts

    flatbush.add(x, y, x + w, y + w)
    items.push({ bin1, bin2, counts, region1Idx, region2Idx })
  }

  flatbush.finish()

  return {
    positions,
    counts: countValues,
    numContacts: features.length,
    colorMaxScore,
    binWidth: w,
    flatbush: flatbush.data,
    items,
  }
}
