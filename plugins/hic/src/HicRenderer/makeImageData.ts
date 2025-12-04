import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { interpolateRgbBasis } from '@mui/x-charts-vendor/d3-interpolate'
import {
  scaleSequential,
  scaleSequentialLog,
} from '@mui/x-charts-vendor/d3-scale'

import interpolateViridis from './viridis'

import type {
  HicFeature,
  RenderArgsDeserializedWithFeatures,
} from './HicRenderer'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgs as ServerSideRenderArgs } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

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
) {
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
  if (features.length) {
    let maxScore = 0
    let minBin = 0
    let maxBin = 0
    checkStopToken(stopToken)
    for (const { bin1, bin2, counts } of features) {
      maxScore = Math.max(counts, maxScore)
      minBin = Math.min(Math.min(bin1, bin2), minBin)
      maxBin = Math.max(Math.max(bin1, bin2), maxBin)
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
    forEachWithStopTokenCheck(features, stopToken, (f: HicFeature) => {
      const { bin1, bin2, counts, region1Idx, region2Idx } = f

      // Get the bin offset for each region
      const offset1 = regionBinOffsets[region1Idx] ?? 0
      const offset2 = regionBinOffsets[region2Idx] ?? 0

      // Get the pixel offset for each region
      const pixelOffset1 = regionPixelOffsets[region1Idx] ?? 0
      const pixelOffset2 = regionPixelOffsets[region2Idx] ?? 0

      ctx.fillStyle = readConfObject(config, 'color', {
        count: counts,
        maxScore,
        baseColor,
        scale,
        useLogScale,
      })

      // Position the bin relative to its region's bin offset, then add the region's pixel offset
      // Convert pixel offset to bin-space: pixelOffset * bpPerPx gives bp, then / res gives bins
      const binOffset1 = (pixelOffset1 * bpPerPx) / res
      const binOffset2 = (pixelOffset2 * bpPerPx) / res
      const x = (bin1 - offset1 + binOffset1) * w
      const y = (bin2 - offset2 + binOffset2) * w
      ctx.fillRect(x, y, w, w)
    })
    ctx.restore()
  }
  return undefined
}
