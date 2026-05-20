import { readConfigValue } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { updateStatus } from '@jbrowse/core/util'
import { cssColorToABGR as colorToUint32 } from '@jbrowse/core/util/colorBits'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type {
  MultiBedRenderResult,
  RenderMultiBedDataArgs,
  RenderMultiBedDataResult,
} from './rpcTypes.ts'
import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// Worker entry for the multi-canvas display. Emits one rect per feature; Y is
// left at 0 here — main thread applies lane offsets in computeLaneLaidOutData.
// The output shape matches FeatureDataResult so the existing CanvasFeatureBackend
// can upload and render it unchanged.
export async function executeRenderMultiBedData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderMultiBedDataArgs
}): Promise<RenderMultiBedDataResult> {
  const {
    sessionId,
    adapterConfig,
    displayConfig,
    region,
    bpPerPx,
    sources,
    maxFeatureDensity,
    theme: themeOptions,
    stopToken,
    statusCallback = () => {},
  } = args

  // theme is built for parity with RenderFeatureData and possible future
  // theme-derived colors; not consumed today.
  createJBrowseTheme(themeOptions)

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const fetchOpts = { sources, stopToken }
  const featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () => firstValueFrom(dataAdapter.getFeatures(region, fetchOpts).pipe(toArray())),
  )
  checkStopToken2(stopTokenCheck)

  if (maxFeatureDensity !== undefined && bpPerPx) {
    const regionWidthPx = (region.end - region.start) / bpPerPx
    const featureDensity = featuresArray.length / regionWidthPx
    if (featureDensity > maxFeatureDensity) {
      return {
        regionTooLarge: true,
        featureCount: featuresArray.length,
      }
    }
  }

  const { laneField, laneHeight } = displayConfig

  const regionStart = Math.floor(region.start)
  const regionEnd = Math.ceil(region.end)

  // Single pass: build flatbush + parallel rect arrays directly. No
  // GranularRectLayout — Y stays 0 here and the main thread sets it per lane.
  const visible = featuresArray.filter(f => {
    const start = f.get('start')
    const end = f.get('end')
    return end > regionStart && start < regionEnd
  })

  const n = visible.length
  const rectPositions = new Uint32Array(n * 2)
  const rectYs = new Float32Array(n)
  const rectHeights = new Float32Array(n)
  const rectColors = new Uint32Array(n)
  const rectFeatureIndices = new Uint32Array(n)
  const flatbushItems: FlatbushItem[] = new Array(n)
  const laneKeys = new Array<string>(n)
  const discoveredSet = new Set<string>()

  for (let i = 0; i < n; i++) {
    const feature = visible[i]!
    const start = feature.get('start')
    const end = feature.get('end')
    const laneVal = feature.get(laneField)
    const laneKey = laneVal === undefined || laneVal === null ? '' : String(laneVal)
    discoveredSet.add(laneKey)

    const fill = readConfigValue<string>(displayConfig, 'color', feature)

    rectPositions[i * 2] = start
    rectPositions[i * 2 + 1] = end
    rectYs[i] = 0
    rectHeights[i] = laneHeight
    rectColors[i] = colorToUint32(fill)
    rectFeatureIndices[i] = i

    const name = feature.get('name')
    flatbushItems[i] = {
      kind: 'feature',
      featureId: feature.id(),
      type: feature.get('type'),
      startBp: start,
      endBp: end,
      topPx: 0,
      bottomPx: laneHeight,
      featureHeightPx: laneHeight,
      tooltip: name
        ? `${name}${laneKey ? ` (${laneKey})` : ''}`
        : `${start.toLocaleString()}-${end.toLocaleString()}${laneKey ? ` (${laneKey})` : ''}`,
      name,
    }
    laneKeys[i] = laneKey
  }

  const empty = {
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineColors: new Uint32Array(0),
    lineDirections: new Int8Array(0),
    lineFeatureIndices: new Uint32Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowDirections: new Int8Array(0),
    arrowColors: new Uint32Array(0),
    arrowFeatureIndices: new Uint32Array(0),
  }

  const result: MultiBedRenderResult = {
    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    rectFeatureIndices,
    ...empty,
    flatbushItems,
    subfeatureInfos: [],
    floatingLabelsData: {},
    featureCount: n,
    outlineColor: 0,
    laneKeys,
    discoveredSources: [...discoveredSet],
  }

  const transferables = [
    rectPositions.buffer,
    rectYs.buffer,
    rectHeights.buffer,
    rectColors.buffer,
    rectFeatureIndices.buffer,
    empty.linePositions.buffer,
    empty.lineYs.buffer,
    empty.lineColors.buffer,
    empty.lineDirections.buffer,
    empty.lineFeatureIndices.buffer,
    empty.arrowXs.buffer,
    empty.arrowYs.buffer,
    empty.arrowDirections.buffer,
    empty.arrowColors.buffer,
    empty.arrowFeatureIndices.buffer,
  ] as ArrayBuffer[]

  return rpcResult(result, transferables) as unknown as RenderMultiBedDataResult
}
