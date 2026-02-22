import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import Flatbush from '@jbrowse/core/util/flatbush'

import type { WebGLHicDataResult } from './types.ts'
import type { MultiRegionContactRecord } from '../HicAdapter/HicAdapter.ts'
import type { HicFlatbushItem } from '../HicRenderer/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'

interface HicDataAdapter {
  getResolution: (bp: number) => Promise<number>
  getMultiRegionContactRecords: (
    regions: Region[],
    opts: Record<string, unknown>,
  ) => Promise<MultiRegionContactRecord[]>
}

interface RenderWebGLHicDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  resolution: number
  normalization: string
  displayHeight?: number
  mode?: string
}

export async function executeRenderWebGLHicData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderWebGLHicDataArgs
}): Promise<WebGLHicDataResult> {
  const {
    sessionId,
    adapterConfig,
    regions,
    bpPerPx,
    resolution,
    normalization,
    displayHeight,
    mode,
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as unknown as HicDataAdapter

  const res = await adapter.getResolution(bpPerPx / resolution)
  const w = res / (bpPerPx * Math.sqrt(2))

  const regionPixelOffsets: number[] = []
  let cumulativePixelOffset = 0
  for (const region of regions) {
    regionPixelOffsets.push(cumulativePixelOffset)
    cumulativePixelOffset += (region.end - region.start) / bpPerPx
  }

  const regionBinOffsets = regions.map(r => Math.floor(r.start / res))
  const pxToBinFactor = bpPerPx / res
  const regionCombinedOffsets = regionBinOffsets.map(
    (binOffset, i) => (regionPixelOffsets[i] ?? 0) * pxToBinFactor - binOffset,
  )

  let totalWidthBp = 0
  for (const region of regions) {
    totalWidthBp += region.end - region.start
  }
  const width = totalWidthBp / bpPerPx
  const hyp = width / 2
  const height = mode === 'adjust' ? (displayHeight ?? hyp) : hyp
  const yScalar = height / Math.max(height, hyp)

  const features = await adapter.getMultiRegionContactRecords(regions, {
    resolution,
    normalization,
    bpPerPx,
  })

  if (!features.length) {
    const emptyFlatbush = new Flatbush(1)
    emptyFlatbush.add(0, 0, 0, 0)
    emptyFlatbush.finish()
    return {
      positions: new Float32Array(0),
      counts: new Float32Array(0),
      numContacts: 0,
      maxScore: 0,
      binWidth: w,
      yScalar,
      flatbush: emptyFlatbush.data,
      items: [],
    }
  }

  let maxScore = 0
  for (const { counts } of features) {
    if (counts > maxScore) {
      maxScore = counts
    }
  }

  const positions = new Float32Array(features.length * 2)
  const countValues = new Float32Array(features.length)
  const items: HicFlatbushItem[] = []
  const flatbush = new Flatbush(Math.max(features.length, 1))

  for (const [i, feature] of features.entries()) {
    const { bin1, bin2, counts, region1Idx, region2Idx } = feature

    const x = (bin1 + (regionCombinedOffsets[region1Idx] ?? 0)) * w
    const y = (bin2 + (regionCombinedOffsets[region2Idx] ?? 0)) * w

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
    maxScore,
    binWidth: w,
    yScalar,
    flatbush: flatbush.data,
    items,
  }
}
