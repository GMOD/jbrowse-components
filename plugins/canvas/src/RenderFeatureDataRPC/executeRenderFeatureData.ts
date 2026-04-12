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
import type { FeatureLayout, PeptideData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

const workerTheme = {
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
} as Theme

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
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  let featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () => firstValueFrom(dataAdapter.getFeatures(region).pipe(toArray())),
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
  const regionWidth = Math.ceil(region.end - region.start)
  const bpPerPx = requestedBpPerPx || 1

  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id)) {
      features.set(id, f)
    }
  }

  const layouts = await updateStatus(
    'Computing layout',
    statusCallback,
    async () => {
      const reversed = region.reversed ?? false
      const records: FeatureLayout[] = []
      for (const feature of features.values()) {
        records.push(layoutFeature({ feature, bpPerPx, reversed, config: displayConfig }))
      }
      return records
    },
  )
  checkStopToken2(stopTokenCheck)

  let peptideDataMap: Map<string, PeptideData> | undefined
  if (colorByCDS && sequenceAdapter && shouldRenderPeptideBackground(bpPerPx)) {
    peptideDataMap = await updateStatus(
      'Fetching peptide data',
      statusCallback,
      async () =>
        fetchPeptideData(
          pluginManager,
          {
            sessionId,
            sequenceAdapter,
            colorByCDS: true,
            bpPerPx,
            regions: [region],
          },
          features,
        ),
    )
  }

  checkStopToken2(stopTokenCheck)

  const packed = await updateStatus('Collecting render data', statusCallback, () =>
    collectRenderData(
      layouts,
      regionStart,
      regionWidth,
      displayConfig,
      workerTheme,
      !!colorByCDS,
      peptideDataMap,
    ),
  )

  checkStopToken2(stopTokenCheck)

  const result: FeatureDataResult = {
    regionStart,

    rectPositions: packed.rectPositions,
    rectYs: packed.rectYs,
    rectHeights: packed.rectHeights,
    rectColors: packed.rectColors,

    linePositions: packed.linePositions,
    lineYs: packed.lineYs,
    lineColors: packed.lineColors,
    lineDirections: packed.lineDirections,

    arrowXs: packed.arrowXs,
    arrowYs: packed.arrowYs,
    arrowDirections: packed.arrowDirections,
    arrowColors: packed.arrowColors,

    flatbushItems: packed.flatbushItems,
    subfeatureInfos: packed.subfeatureInfos,

    rectFeatureIndices: packed.rectFeatureIndices,
    lineFeatureIndices: packed.lineFeatureIndices,
    arrowFeatureIndices: packed.arrowFeatureIndices,

    floatingLabelsData: packed.floatingLabelsData,

    aminoAcidOverlay: packed.aminoAcidOverlay,

    featureCount: features.size,
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
    result.arrowColors.buffer,
    result.arrowFeatureIndices.buffer,
  ] as ArrayBuffer[]

  return rpcResult(result, transferables) as any
}
