import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { interpolateRgbBasis } from '@mui/x-charts-vendor/d3-interpolate'
import {
  scaleSequential,
  scaleSequentialLog,
} from '@mui/x-charts-vendor/d3-scale'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import interpolateViridis from './viridis'

import type { HicFeature, RenderArgsDeserialized } from './HicRenderer'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface HicDataAdapter extends BaseFeatureDataAdapter {
  getResolution: (bp: number) => Promise<number>
}

function interpolateJuicebox(t: number) {
  const r = Math.round(t * 255)
  const a = t
  return `rgba(${r},0,0,${a})`
}

const colorSchemes: Record<string, (t: number) => string> = {
  juicebox: interpolateJuicebox,
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

export async function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: RenderArgsDeserialized & {
    yScalar: number
    pluginManager: PluginManager
    statusCallback?: (arg: string) => void
  },
) {
  const {
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
    statusCallback = () => {},
  } = props

  const region = regions[0]!
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  statusCallback('Fetching Hi-C data')
  const features = (await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, props)
      .pipe(toArray()),
  )) as unknown as HicFeature[]

  if (!features.length) {
    return undefined
  }

  statusCallback('Drawing Hi-C matrix')
  checkStopToken(stopToken)

  const res = await (dataAdapter as HicDataAdapter).getResolution(
    bpPerPx / resolution,
  )
  const width = (region.end - region.start) / bpPerPx
  const w = res / (bpPerPx * Math.sqrt(2))
  const offset = Math.floor(region.start / res)

  let maxScore = 0
  for (const { counts } of features) {
    if (counts > maxScore) {
      maxScore = counts
    }
  }
  checkStopToken(stopToken)

  const m = useLogScale ? maxScore : maxScore / 20
  const interpolator = colorSchemes[colorScheme ?? ''] ?? colorSchemes.juicebox
  const scale = useLogScale
    ? scaleSequentialLog(interpolator).domain([1, m])
    : scaleSequential(interpolator).domain([0, m])

  if (yScalar) {
    ctx.scale(1, yScalar)
  }
  ctx.save()

  if (region.reversed === true) {
    ctx.scale(-1, 1)
    ctx.translate(-width, 0)
  }
  ctx.rotate(-Math.PI / 4)

  // Check raw config value to optimize the hot loop - avoid JEXL evaluation if default
  const colorSlot = config.color as { value: string } | undefined
  const useDefaultColor = colorSlot?.value === 'jexl:interpolate(count,scale)'

  if (useDefaultColor) {
    for (const { bin1, bin2, counts } of features) {
      ctx.fillStyle = scale(counts)
      ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
    }
  } else {
    const baseColor = colord(readConfObject(config, 'baseColor'))
    for (const { bin1, bin2, counts } of features) {
      ctx.fillStyle = readConfObject(config, 'color', {
        count: counts,
        maxScore,
        baseColor,
        scale,
        useLogScale,
      })
      ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
    }
  }
  ctx.restore()
  return undefined
}
