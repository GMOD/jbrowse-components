import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'
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
  // If resolution > 0, use explicit value; otherwise auto-calculate
  const res =
    resolution > 0
      ? resolution
      : await (dataAdapter as HicDataAdapter).getResolution(bpPerPx)

  console.log('HicRenderer resolution:', {
    requestedResolution: resolution,
    calculatedRes: res,
    bpPerPx,
  })

  // Get pixel offsets from regions (they come with offsetPx from the view)
  // We need to calculate relative offsets from the first region
  const firstRegionOffsetPx = (regions[0] as any)?.offsetPx ?? 0
  const regionOffsets: number[] = []
  for (const region of regions) {
    const regionOffsetPx = (region as any).offsetPx ?? 0
    regionOffsets.push(regionOffsetPx - firstRegionOffsetPx)
  }

  const w = res / (bpPerPx * Math.sqrt(2))

  if (features.length) {
    let maxScore = 0
    checkStopToken(stopToken)
    for (const { counts } of features) {
      maxScore = Math.max(counts, maxScore)
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

    // Pre-compute color function to avoid calling readConfObject in tight loop
    const getColor = (counts: number) => scale(counts)

    if (yScalar) {
      ctx.scale(1, yScalar)
    }
    ctx.save()

    // Handle single region case with rotation (original behavior)
    if (regions.length === 1) {
      const region = regions[0]!
      const width = (region.end - region.start) / bpPerPx
      const offset = Math.floor(region.start / res)

      if (region.reversed === true) {
        ctx.scale(-1, 1)
        ctx.translate(-width, 0)
      }
      ctx.rotate(-Math.PI / 4)

      forEachWithStopTokenCheck(features, stopToken, (f: HicFeature) => {
        const { bin1, bin2, counts } = f
        ctx.fillStyle = getColor(counts)
        ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
      })
    } else {
      // Multi-region case: draw each region's contacts with separate transformations

      // Group features by region pair
      const featuresByPair = new Map<string, HicFeature[]>()
      for (const f of features) {
        const key = `${f.region1Idx}-${f.region2Idx}`
        if (!featuresByPair.has(key)) {
          featuresByPair.set(key, [])
        }
        featuresByPair.get(key)!.push(f)
      }

      // Draw intra-region contacts (diagonal blocks) as triangles
      for (const [i, region_] of regions.entries()) {
        const region = region_
        const offset = Math.floor(region.start / res)
        const regionFeatures = featuresByPair.get(`${i}-${i}`) || []

        ctx.save()
        // Move to the region's starting position
        ctx.translate(regionOffsets[i]!, 0)
        // Rotate around the origin (top-left of this region)
        ctx.rotate(-Math.PI / 4)

        for (const f of regionFeatures) {
          const { bin1, bin2, counts } = f
          ctx.fillStyle = getColor(counts)
          ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
        }
        ctx.restore()
      }

      // Draw inter-region contacts (off-diagonal blocks)
      // These appear as parallelograms connecting the triangles
      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          const region1 = regions[i]!
          const region2 = regions[j]!
          const interFeatures = featuresByPair.get(`${i}-${j}`) || []

          if (interFeatures.length === 0) {
            continue
          }

          const offset1 = Math.floor(region1.start / res)
          const offset2 = Math.floor(region2.start / res)

          // For inter-region contacts, we need to draw in a transformed space
          // The contact at (bin1 in region1, bin2 in region2) should appear
          // at the intersection of the two triangles' coordinate systems
          ctx.save()

          // Position at the midpoint between the two regions on the x-axis
          // and draw the parallelogram that connects them
          const region1EndPx =
            regionOffsets[i]! + (region1.end - region1.start) / bpPerPx
          const region2StartPx = regionOffsets[j]!

          ctx.translate((region1EndPx + region2StartPx) / 2, 0)
          ctx.rotate(-Math.PI / 4)

          for (const f of interFeatures) {
            const { bin1, bin2, counts } = f

            // Calculate positions relative to the inter-region space
            const x1 =
              (bin1 - offset1) * w -
              (((region1.end - region1.start) / bpPerPx) * Math.sqrt(2)) / 2
            const y1 = (bin2 - offset2) * w

            ctx.fillStyle = getColor(counts)
            ctx.fillRect(x1, y1, w, w)
          }
          ctx.restore()
        }
      }
    }

    ctx.restore()
  }
  return undefined
}
