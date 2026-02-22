/**
 * WebGL Wiggle Data RPC Executor
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

import type { WebGLWiggleDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    bicolorPivot?: number
    stopToken?: string
    bpPerPx?: number
    resolution?: number
    statusCallback?: (msg: string) => void
  }
}

export async function executeRenderWebGLWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLWiggleDataResult> {
  const {
    sessionId,
    adapterConfig,
    region,
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

  const featurePositions = new Uint32Array(featuresArray.length * 2)
  const featureScores = new Float32Array(featuresArray.length)
  const featureMinScores = new Float32Array(featuresArray.length)
  const featureMaxScores = new Float32Array(featuresArray.length)
  const posPositions: number[] = []
  const posScores: number[] = []
  const negPositions: number[] = []
  const negScores: number[] = []

  let featureIndex = 0
  for (const feature of featuresArray) {
    const start = feature.get('start')
    const end = feature.get('end')
    const score = feature.get('score') ?? 0
    const summary = feature.get('summary')

    const startOffset = Math.floor(start - regionStart)
    const endOffset = Math.floor(end - regionStart)
    featurePositions[featureIndex * 2] = startOffset
    featurePositions[featureIndex * 2 + 1] = endOffset
    featureScores[featureIndex] = score
    featureMinScores[featureIndex] = summary
      ? (feature.get('minScore') ?? score)
      : score
    featureMaxScores[featureIndex] = summary
      ? (feature.get('maxScore') ?? score)
      : score

    if (score >= bicolorPivot) {
      posPositions.push(startOffset, endOffset)
      posScores.push(score)
    } else {
      negPositions.push(startOffset, endOffset)
      negScores.push(score)
    }

    featureIndex++
  }

  return {
    regionStart,
    featurePositions: featurePositions.slice(0, featureIndex * 2),
    featureScores: featureScores.slice(0, featureIndex),
    featureMinScores: featureMinScores.slice(0, featureIndex),
    featureMaxScores: featureMaxScores.slice(0, featureIndex),
    numFeatures: featureIndex,
    posFeaturePositions: new Uint32Array(posPositions),
    posFeatureScores: new Float32Array(posScores),
    posNumFeatures: posScores.length,
    negFeaturePositions: new Uint32Array(negPositions),
    negFeatureScores: new Float32Array(negScores),
    negNumFeatures: negScores.length,
  }
}
