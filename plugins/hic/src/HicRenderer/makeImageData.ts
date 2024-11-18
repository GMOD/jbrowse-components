import { RenderArgs as ServerSideRenderArgs } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { Region } from '@jbrowse/core/util/types'
import { abortBreakPoint } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { colord } from '@jbrowse/core/util/colord'
import {
  scaleSequential,
  scaleSequentialLog,
} from '@mui/x-charts-vendor/d3-scale'
import { interpolateRgbBasis } from '@mui/x-charts-vendor/d3-interpolate'
import PluginManager from '@jbrowse/core/PluginManager'

import interpolateViridis from './viridis'
import { RenderArgsDeserializedWithFeatures } from './HicRenderer'

interface HicDataAdapter extends BaseFeatureDataAdapter {
  getResolution: (bp: number) => Promise<number>
}

export interface RenderArgs extends ServerSideRenderArgs {
  regions: Region[]
}

export async function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: RenderArgsDeserializedWithFeatures & { pluginManager: PluginManager },
) {
  const {
    features,
    config,
    bpPerPx,
    signal,
    resolution,
    sessionId,
    adapterConfig,
    useLogScale,
    colorScheme,
    regions,
    pluginManager,
  } = props
  const region = regions[0]!
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const res = await (dataAdapter as HicDataAdapter).getResolution(
    bpPerPx / resolution,
  )

  const width = (region.end - region.start) / bpPerPx
  const w = res / (bpPerPx * Math.sqrt(2))
  const baseColor = colord(readConfObject(config, 'baseColor'))
  const offset = Math.floor(region.start / res)
  if (features.length) {
    let maxScore = 0
    let minBin = 0
    let maxBin = 0
    await abortBreakPoint(signal)
    for (const { bin1, bin2, counts } of features) {
      maxScore = Math.max(counts, maxScore)
      minBin = Math.min(Math.min(bin1, bin2), minBin)
      maxBin = Math.max(Math.max(bin1, bin2), maxBin)
    }
    await abortBreakPoint(signal)
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
    ctx.save()

    if (region.reversed === true) {
      ctx.scale(-1, 1)
      ctx.translate(-width, 0)
    }
    ctx.rotate(-Math.PI / 4)
    let start = performance.now()
    for (const { bin1, bin2, counts } of features) {
      ctx.fillStyle = readConfObject(config, 'color', {
        count: counts,
        maxScore,
        baseColor,
        scale,
        useLogScale,
      })
      ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
      if (performance.now() - start > 400) {
        await abortBreakPoint(signal)
        start = performance.now()
      }
    }
    ctx.restore()
  }
  return undefined
}
