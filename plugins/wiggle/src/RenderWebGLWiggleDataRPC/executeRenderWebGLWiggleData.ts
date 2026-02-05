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
  }
}

export async function executeRenderWebGLWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLWiggleDataResult> {
  const { sessionId, adapterConfig, region } = args

  // Get adapter
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  // Fetch features
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(region).pipe(toArray()),
  )

  // Genomic positions are integers, but region bounds from the view can be fractional.
  // Use floor to get integer reference point for storing position offsets.
  const regionStart = Math.floor(region.start)

  // Allocate typed arrays
  const featurePositions = new Uint32Array(featuresArray.length * 2)
  const featureScores = new Float32Array(featuresArray.length)

  let scoreMin = Number.POSITIVE_INFINITY
  let scoreMax = Number.NEGATIVE_INFINITY

  let featureIndex = 0
  for (const feature of featuresArray) {
    const start = feature.get('start')
    const end = feature.get('end')
    const score = feature.get('score') ?? 0

    // Store position as offset from regionStart
    featurePositions[featureIndex * 2] = Math.floor(start - regionStart)
    featurePositions[featureIndex * 2 + 1] = Math.floor(end - regionStart)

    featureScores[featureIndex] = score

    if (score < scoreMin) {
      scoreMin = score
    }
    if (score > scoreMax) {
      scoreMax = score
    }

    featureIndex++
  }

  // Handle empty data case
  if (featureIndex === 0) {
    scoreMin = 0
    scoreMax = 0
  }

  return {
    regionStart,
    featurePositions: featurePositions.slice(0, featureIndex * 2),
    featureScores: featureScores.slice(0, featureIndex),
    numFeatures: featureIndex,
    scoreMin,
    scoreMax,
  }
}
