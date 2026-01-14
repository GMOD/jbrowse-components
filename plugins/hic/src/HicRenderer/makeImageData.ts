import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { colord } from '@jbrowse/core/util/colord'
import Flatbush from '@jbrowse/core/util/flatbush'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { interpolateRgbBasis } from '@mui/x-charts-vendor/d3-interpolate'
import {
  scaleSequential,
  scaleSequentialLog,
} from '@mui/x-charts-vendor/d3-scale'

import interpolateViridis from './viridis.ts'

import type { RenderArgsDeserializedWithFeatures } from './HicRenderer.tsx'
import type { HicFlatbushItem } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgs as ServerSideRenderArgs } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

export interface MakeImageDataResult {
  flatbush: ArrayBufferLike
  items: HicFlatbushItem[]
  maxScore: number
  w: number
}

interface HicDataAdapter extends BaseFeatureDataAdapter {
  getResolution: (bp: number) => Promise<number>
}

export interface RenderArgs extends ServerSideRenderArgs {
  regions: Region[]
}

export async function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: RenderArgsDeserializedWithFeatures & {
    yScalar: number
    pluginManager: PluginManager
  },
): Promise<MakeImageDataResult | undefined> {
  const {
    features,
    config,
    bpPerPx,
    stopToken,
    resolution,
    sessionId,
    adapterConfig,
    useLogScale,
    colorScheme,
    regions,
    pluginManager,
    yScalar,
  } = props

  const { statusCallback = () => {} } = props
  statusCallback('Drawing Hi-C matrix')
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const res = await (dataAdapter as HicDataAdapter).getResolution(
    bpPerPx / resolution,
  )

  const lastCheck = createStopTokenChecker(stopToken)
  const w = res / (bpPerPx * Math.sqrt(2))
  const baseColor = colord(readConfObject(config, 'baseColor'))

  // Calculate pixel offset for each region (cumulative)
  const regionPixelOffsets: number[] = []
  let cumulativePixelOffset = 0
  for (const region of regions) {
    regionPixelOffsets.push(cumulativePixelOffset)
    cumulativePixelOffset += (region.end - region.start) / bpPerPx
  }

  // Calculate bin offset within each region
  const regionBinOffsets = regions.map(region => Math.floor(region.start / res))

  if (!features.length) {
    return undefined
  }

  let maxScore = 0
  checkStopToken(stopToken)
  for (const { counts } of features) {
    if (counts > maxScore) {
      maxScore = counts
    }
  }
  checkStopToken(stopToken)
  const colorSchemes = {
    juicebox: ['rgba(0,0,0,0)', 'red'],
    fall: interpolateRgbBasis([
      'rgb(255, 255, 255)',
      'rgb(255, 255, 204)',
      'rgb(255, 237, 160)',
      'rgb(254, 217, 118)',
      'rgb(254, 178, 76)',
      'rgb(253, 141, 60)',
      'rgb(252, 78, 42)',
      'rgb(227, 26, 28)',
      'rgb(189, 0, 38)',
      'rgb(128, 0, 38)',
      'rgb(0, 0, 0)',
    ]),
    viridis: interpolateViridis,
  }
  const m = useLogScale ? maxScore : maxScore / 20

  // @ts-expect-error
  const x1 = colorSchemes[colorScheme] || colorSchemes.juicebox
  const scale = useLogScale
    ? scaleSequentialLog(x1).domain([1, m])
    : scaleSequential(x1).domain([0, m])
  if (yScalar) {
    ctx.scale(1, yScalar)
  }
  ctx.save()

  // TODO: handle reversed regions for multi-region case
  ctx.rotate(-Math.PI / 4)

  // Precompute combined offsets for each region (bin offset + pixel-to-bin conversion)
  const pxToBinFactor = bpPerPx / res
  const regionCombinedOffsets = regionBinOffsets.map(
    (binOffset, i) => (regionPixelOffsets[i] ?? 0) * pxToBinFactor - binOffset,
  )

  // Build Flatbush index and items array
  // Store coordinates in the unrotated space (before -45° rotation)
  // Client will transform mouse coords with inverse rotation to query
  const coords: number[] = []
  const items: HicFlatbushItem[] = []
  for (let i = 0, l = features.length; i < l; i++) {
    const { bin1, bin2, counts, region1Idx, region2Idx } = features[i]!
    ctx.fillStyle = readConfObject(config, 'color', {
      count: counts,
      maxScore,
      baseColor,
      scale,
      useLogScale,
    })

    const x = (bin1 + (regionCombinedOffsets[region1Idx] ?? 0)) * w
    const y = (bin2 + (regionCombinedOffsets[region2Idx] ?? 0)) * w
    ctx.fillRect(x, y, w, w)

    // Store the unrotated rectangle coordinates for Flatbush
    coords.push(x, y, x + w, y + w)
    items.push({ bin1, bin2, counts, region1Idx, region2Idx })
    checkStopToken2(lastCheck)
  }
  ctx.restore()

  // Build Flatbush spatial index
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
    maxScore,
    w,
  }
}
