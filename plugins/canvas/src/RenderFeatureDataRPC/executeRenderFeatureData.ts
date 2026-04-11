/**
 * WebGL Feature Data RPC Executor
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * All position data in this module uses integer coordinates. View region bounds
 * (region.start, region.end) can be fractional from scrolling/zooming, so we
 * convert to integers: regionStart = floor(region.start). All positions are then
 * stored as integer offsets from regionStart. This ensures consistent alignment
 * between feature rectangles, lines, and hit detection.
 */

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { cssColorToRgba } from '@jbrowse/core/util/colorBits'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { collectRenderData } from './collectRenderData.ts'
import { layoutFeature } from './layout/layoutFeature.ts'
import { fetchPeptideData } from './peptides/peptideUtils.ts'
import { shouldRenderPeptideBackground } from './zoomThresholds.ts'

import type {
  FeatureDataResult,
  RenderFeatureDataArgs,
  RenderFeatureDataResult,
} from './rpcTypes.ts'
import type { LayoutRecord, PeptideData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

function writeColorBytes(out: Uint8Array, index: number, color: number) {
  const o = index * 4
  out[o] = color & 0xff
  out[o + 1] = (color >> 8) & 0xff
  out[o + 2] = (color >> 16) & 0xff
  out[o + 3] = (color >> 24) & 0xff
}

function colorToUint32(colorStr: string) {
  const [r, g, b, a] = cssColorToRgba(colorStr)
  return (a << 24) | (b << 16) | (g << 8) | r
}

export { colorToUint32, writeColorBytes }

export async function executeRenderFeatureData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderFeatureDataArgs
}): Promise<RenderFeatureDataResult> {
  const {
    sessionId,
    adapterConfig,
    displayConfig,
    region,
    bpPerPx: requestedBpPerPx,
    colorByCDS,
    sequenceAdapter,
    showOnlyGenes,
    maxFeatureDensity,
    stopToken,
    statusCallback = () => {},
  } = args as RenderFeatureDataArgs & {
    statusCallback?: (msg: string) => void
  }

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  let featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeatures(region).pipe(toArray()),
      ),
  )
  checkStopToken2(stopTokenCheck)

  if (showOnlyGenes) {
    featuresArray = featuresArray.filter(f => f.get('type') === 'gene')
  }

  if (maxFeatureDensity !== undefined && requestedBpPerPx) {
    const regionWidthPx = (region.end - region.start) / requestedBpPerPx
    const featureDensity = featuresArray.length / regionWidthPx
    if (featureDensity > maxFeatureDensity) {
      return {
        regionTooLarge: true,
        featureCount: featuresArray.length,
      }
    }
  }

  const regionStart = Math.floor(region.start)
  const bpPerPx = requestedBpPerPx || 1

  const mockTheme = {
    palette: {
      text: { secondary: '#666666' },
      framesCDS: [
        null,
        { main: '#FF8080' },
        { main: '#80FF80' },
        { main: '#8080FF' },
        { main: '#8080FF' },
        { main: '#80FF80' },
        { main: '#FF8080' },
      ],
    },
  }

  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id)) {
      features.set(id, f)
    }
  }

  const layoutRecords = await updateStatus(
    'Computing layout',
    statusCallback,
    async () => {
      const reversed = region.reversed ?? false
      const records: LayoutRecord[] = []
      for (const feature of features.values()) {
        const featureLayout = layoutFeature({
          feature,
          bpPerPx,
          reversed,
          config: displayConfig,
        })
        records.push({
          feature,
          layout: featureLayout,
          layoutHeight: featureLayout.height,
        })
      }
      return records
    },
  )
  checkStopToken2(stopTokenCheck)

  let peptideDataMap: Map<string, PeptideData> | undefined
  if (colorByCDS && sequenceAdapter && shouldRenderPeptideBackground(bpPerPx)) {
    const mockRenderProps = {
      sessionId,
      sequenceAdapter,
      colorByCDS: true,
      bpPerPx,
      regions: [region],
    }
    peptideDataMap = await updateStatus(
      'Fetching peptide data',
      statusCallback,
      async () =>
        fetchPeptideData(pluginManager, mockRenderProps as any, features),
    )
  }

  checkStopToken2(stopTokenCheck)

  const {
    rects,
    lines,
    arrows,
    floatingLabelsData,
    flatbushItems,
    subfeatureInfos,
    aminoAcidOverlay,
  } = await updateStatus('Collecting render data', statusCallback, () =>
    collectRenderData(
      layoutRecords,
      regionStart,
      displayConfig,
      mockTheme as Theme,
      !!colorByCDS,
      peptideDataMap,
    ),
  )

  checkStopToken2(stopTokenCheck)

  const regionWidth = Math.ceil(region.end - region.start)
  const visibleRects = rects.filter(
    r => r.endOffset > 0 && r.startOffset < regionWidth,
  )
  const visibleLines = lines.filter(
    l => l.endOffset > 0 && l.startOffset < regionWidth,
  )
  const visibleArrows = arrows.filter(a => a.x >= 0 && a.x < regionWidth)

  const rectPositions = new Uint32Array(visibleRects.length * 2)
  const rectYs = new Float32Array(visibleRects.length)
  const rectHeights = new Float32Array(visibleRects.length)
  const rectColors = new Uint8Array(visibleRects.length * 4)
  const rectFeatureIndices = new Uint32Array(visibleRects.length)

  for (const [i, rect] of visibleRects.entries()) {
    rectPositions[i * 2] = Math.max(0, rect.startOffset)
    rectPositions[i * 2 + 1] = Math.max(0, rect.endOffset)
    rectYs[i] = rect.y
    rectHeights[i] = rect.height
    writeColorBytes(rectColors, i, rect.color)
    rectFeatureIndices[i] = rect.flatbushIdx
  }

  const linePositions = new Uint32Array(visibleLines.length * 2)
  const lineYs = new Float32Array(visibleLines.length)
  const lineColors = new Uint8Array(visibleLines.length * 4)
  const lineDirections = new Int8Array(visibleLines.length)
  const lineFeatureIndices = new Uint32Array(visibleLines.length)

  for (const [i, line] of visibleLines.entries()) {
    linePositions[i * 2] = Math.max(0, line.startOffset)
    linePositions[i * 2 + 1] = Math.max(0, line.endOffset)
    lineYs[i] = line.y
    writeColorBytes(lineColors, i, line.color)
    lineDirections[i] = line.direction
    lineFeatureIndices[i] = line.flatbushIdx
  }

  const arrowXs = new Uint32Array(visibleArrows.length)
  const arrowYs = new Float32Array(visibleArrows.length)
  const arrowDirections = new Int8Array(visibleArrows.length)
  const arrowHeights = new Float32Array(visibleArrows.length)
  const arrowColors = new Uint8Array(visibleArrows.length * 4)
  const arrowFeatureIndices = new Uint32Array(visibleArrows.length)

  for (const [i, arrow] of visibleArrows.entries()) {
    arrowXs[i] = Math.max(0, arrow.x)
    arrowYs[i] = arrow.y
    arrowDirections[i] = arrow.direction
    arrowHeights[i] = arrow.height
    writeColorBytes(arrowColors, i, arrow.color)
    arrowFeatureIndices[i] = arrow.flatbushIdx
  }

  const result: FeatureDataResult = {
    regionStart,

    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    numRects: visibleRects.length,

    linePositions,
    lineYs,
    lineColors,
    lineDirections,
    numLines: visibleLines.length,

    arrowXs,
    arrowYs,
    arrowDirections,
    arrowHeights,
    arrowColors,
    numArrows: visibleArrows.length,

    flatbushItems,
    subfeatureInfos,

    rectFeatureIndices,
    lineFeatureIndices,
    arrowFeatureIndices,

    floatingLabelsData,

    aminoAcidOverlay:
      aminoAcidOverlay.length > 0 ? aminoAcidOverlay : undefined,

    featureCount: features.size,
    maxY: 0,
  }

  const transferables = [
    result.rectPositions.buffer,
    result.rectYs.buffer,
    result.rectHeights.buffer,
    result.rectColors.buffer,
    result.rectFeatureIndices.buffer,
    result.linePositions.buffer,
    result.lineYs.buffer,
    result.lineColors.buffer,
    result.lineDirections.buffer,
    result.lineFeatureIndices.buffer,
    result.arrowXs.buffer,
    result.arrowYs.buffer,
    result.arrowDirections.buffer,
    result.arrowHeights.buffer,
    result.arrowColors.buffer,
    result.arrowFeatureIndices.buffer,
  ] as ArrayBuffer[]

  return rpcResult(result, transferables) as any
}
