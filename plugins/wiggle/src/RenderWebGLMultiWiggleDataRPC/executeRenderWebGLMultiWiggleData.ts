import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type {
  WebGLMultiWiggleDataResult,
  WebGLMultiWiggleSourceData,
} from './types.ts'
import type { Region } from '@jbrowse/core/util'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'

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
  }
}

export async function executeRenderWebGLMultiWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLMultiWiggleDataResult> {
  const { sessionId, adapterConfig, region, sources: sourcesArg } = args

  // Get adapter
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  // Get sources if adapter supports it
  let sourcesList: SourceInfo[] = sourcesArg || []
  if (sourcesList.length === 0 && 'getSources' in dataAdapter) {
    const adapterSources = await (
      dataAdapter as unknown as { getSources: () => Promise<SourceInfo[]> }
    ).getSources()
    sourcesList = adapterSources
  }

  // Fetch all features
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(region).pipe(toArray()),
  )

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
  let globalScoreMin = Number.POSITIVE_INFINITY
  let globalScoreMax = Number.NEGATIVE_INFINITY

  // Use sourcesList order if available, otherwise use whatever sources we found
  const sourceNames =
    sourcesList.length > 0
      ? sourcesList.map(s => s.name)
      : Array.from(featuresBySource.keys())

  // Default colors for sources
  const defaultColors = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf',
  ]

  for (let i = 0; i < sourceNames.length; i++) {
    const sourceName = sourceNames[i]!
    const features = featuresBySource.get(sourceName) || []
    const sourceInfo = sourcesList.find(s => s.name === sourceName)
    const color = sourceInfo?.color || defaultColors[i % defaultColors.length]!

    const featurePositions = new Uint32Array(features.length * 2)
    const featureScores = new Float32Array(features.length)

    let scoreMin = Number.POSITIVE_INFINITY
    let scoreMax = Number.NEGATIVE_INFINITY

    for (let j = 0; j < features.length; j++) {
      const feature = features[j]!
      const start = feature.get('start')
      const end = feature.get('end')
      const score = feature.get('score') ?? 0

      featurePositions[j * 2] = Math.floor(start - regionStart)
      featurePositions[j * 2 + 1] = Math.floor(end - regionStart)
      featureScores[j] = score

      if (score < scoreMin) {
        scoreMin = score
      }
      if (score > scoreMax) {
        scoreMax = score
      }
    }

    // Handle empty source
    if (features.length === 0) {
      scoreMin = 0
      scoreMax = 0
    }

    if (scoreMin < globalScoreMin) {
      globalScoreMin = scoreMin
    }
    if (scoreMax > globalScoreMax) {
      globalScoreMax = scoreMax
    }

    sourcesData.push({
      name: sourceName,
      color,
      featurePositions,
      featureScores,
      numFeatures: features.length,
      scoreMin,
      scoreMax,
    })
  }

  // Handle case with no data
  if (sourcesData.length === 0) {
    globalScoreMin = 0
    globalScoreMax = 0
  }

  return {
    regionStart,
    sources: sourcesData,
    scoreMin: globalScoreMin,
    scoreMax: globalScoreMax,
  }
}
