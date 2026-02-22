/**
 * WebGL Multi-Wiggle Data RPC Executor
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * All position data in this module uses integer coordinates. View region bounds
 * (region.start, region.end) can be fractional from scrolling/zooming, so we
 * convert to integers: regionStart = floor(region.start). All positions are then
 * stored as integer offsets from regionStart. This ensures consistent alignment
 * between data points and rendered features.
 */

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'

import type {
  WebGLMultiWiggleDataResult,
  WebGLMultiWiggleSourceData,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

interface SourceInfo {
  name: string
  color?: string
}

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    sources?: SourceInfo[]
    bicolorPivot?: number
    stopToken?: string
    bpPerPx?: number
    resolution?: number
    statusCallback?: (msg: string) => void
  }
}

export async function executeRenderWebGLMultiWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLMultiWiggleDataResult> {
  const {
    sessionId,
    adapterConfig,
    region,
    sources: sourcesArg,
    bicolorPivot = 0,
    stopToken,
    bpPerPx = 0,
    resolution = 1,
    statusCallback,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  let sourcesList: SourceInfo[] = sourcesArg || []
  if (sourcesList.length === 0 && 'getSources' in dataAdapter) {
    const adapterSources = await (
      dataAdapter as unknown as { getSources: () => Promise<SourceInfo[]> }
    ).getSources()
    sourcesList = adapterSources
  }

  const fetchOpts = { bpPerPx, resolution }
  const featuresArray = await updateStatus(
    'Loading wiggle data',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeatures(region, fetchOpts).pipe(toArray()),
      ),
  )

  checkStopToken2(stopTokenCheck)

  // Genomic positions are integers, but region bounds from the view can be fractional.
  // Use floor to get integer reference point for storing position offsets.
  const regionStart = Math.floor(region.start)

  // Group features by source
  const featuresBySource = new Map<string, typeof featuresArray>()
  for (const feature of featuresArray) {
    const source = feature.get('source') || 'default'
    const existing = featuresBySource.get(source)
    if (existing) {
      existing.push(feature)
    } else {
      featuresBySource.set(source, [feature])
    }
  }

  // Build per-source data
  const sourcesData: WebGLMultiWiggleSourceData[] = []

  // Use sourcesList order if available, otherwise use whatever sources we found
  const sourceNames =
    sourcesList.length > 0
      ? sourcesList.map(s => s.name)
      : Array.from(featuresBySource.keys())

  for (const sourceName of sourceNames) {
    const features = featuresBySource.get(sourceName) || []
    const sourceInfo = sourcesList.find(s => s.name === sourceName)
    const color = sourceInfo?.color || WIGGLE_POS_COLOR_DEFAULT

    const featurePositions = new Uint32Array(features.length * 2)
    const featureScores = new Float32Array(features.length)
    const featureMinScores = new Float32Array(features.length)
    const featureMaxScores = new Float32Array(features.length)
    const posPositions: number[] = []
    const posScores: number[] = []
    const negPositions: number[] = []
    const negScores: number[] = []

    for (const [j, feature_] of features.entries()) {
      const feature = feature_
      const start = feature.get('start')
      const end = feature.get('end')
      const score = feature.get('score') ?? 0
      const summary = feature.get('summary')

      const startOffset = Math.floor(start - regionStart)
      const endOffset = Math.floor(end - regionStart)
      featurePositions[j * 2] = startOffset
      featurePositions[j * 2 + 1] = endOffset
      featureScores[j] = score
      featureMinScores[j] = summary
        ? (feature.get('minScore') ?? score)
        : score
      featureMaxScores[j] = summary
        ? (feature.get('maxScore') ?? score)
        : score

      if (score >= bicolorPivot) {
        posPositions.push(startOffset, endOffset)
        posScores.push(score)
      } else {
        negPositions.push(startOffset, endOffset)
        negScores.push(score)
      }
    }

    sourcesData.push({
      name: sourceName,
      color,
      featurePositions,
      featureScores,
      featureMinScores,
      featureMaxScores,
      numFeatures: features.length,
      posFeaturePositions: new Uint32Array(posPositions),
      posFeatureScores: new Float32Array(posScores),
      posNumFeatures: posScores.length,
      negFeaturePositions: new Uint32Array(negPositions),
      negFeatureScores: new Float32Array(negScores),
      negNumFeatures: negScores.length,
    })
  }

  return {
    regionStart,
    sources: sourcesData,
  }
}
