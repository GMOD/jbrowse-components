import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, groupBy, max, min } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { scaleLog } from '@mui/x-charts-vendor/d3-scale'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { PairType, getPairedType } from '../shared/color.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'

import type { WebGLCloudDataResult } from './types.ts'
import type { ChainStats } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    sequenceAdapter?: Record<string, unknown>
    region: Region
    filterBy?: Record<string, unknown>
    height: number
    stopToken?: string
  }
}

const CLOUD_HEIGHT_PADDING = 20
const DEFAULT_MAX_DISTANCE = 10000

function createCloudScale(maxDistance: number, height: number) {
  return scaleLog()
    .base(2)
    .domain([1, Math.max(2, maxDistance)])
    .range([0, height - CLOUD_HEIGHT_PADDING])
    .clamp(true)
}

function getColorType(feature: Feature, stats?: ChainStats): number {
  const pairType = getPairedType({
    type: 'insertSizeAndOrientation',
    f: {
      refName: feature.get('refName'),
      next_ref: feature.get('next_ref'),
      pair_orientation: feature.get('pair_orientation'),
      tlen: feature.get('template_length'),
      flags: feature.get('flags'),
    },
    stats,
  })

  switch (pairType) {
    case PairType.LONG_INSERT:
      return 1
    case PairType.SHORT_INSERT:
      return 2
    case PairType.INTER_CHROM:
      return 3
    case PairType.ABNORMAL_ORIENTATION:
      return 4
    default:
      return 0
  }
}

export async function executeRenderWebGLCloudData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLCloudDataResult> {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    height,
    stopToken,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  // Get adapter
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  // Set sequence adapter for CRAM files
  if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
    dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
  }

  // Fetch features
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeaturesInMultipleRegions([region], args).pipe(toArray()),
  )

  checkStopToken2(stopTokenCheck)

  // Dedupe features by ID
  const deduped = dedupe(featuresArray, f => f.id())

  // Calculate insert size stats
  const tlens: number[] = []
  for (const f of deduped) {
    const flags = f.get('flags')
    if (flags & 2 && !(flags & 256) && !(flags & 2048)) {
      const tlen = f.get('template_length')
      if (tlen !== 0 && !Number.isNaN(tlen)) {
        tlens.push(Math.abs(tlen))
      }
    }
  }

  let stats: ChainStats | undefined
  if (tlens.length > 0) {
    const insertSizeStats = getInsertSizeStats(tlens)
    stats = {
      ...insertSizeStats,
      max: max(tlens),
      min: min(tlens),
    }
  }

  // Group into chains by read name
  const chains = Object.values(groupBy(deduped, f => f.get('name')))

  const regionStart = region.start

  // Compute max distance for log scale
  let maxDistance = Number.MIN_VALUE
  for (const chain of chains) {
    if (chain.length >= 2) {
      const first = chain[0]!
      const last = chain[chain.length - 1]!
      const distance = Math.abs(last.get('end') - first.get('start'))
      if (distance > 0) {
        maxDistance = Math.max(maxDistance, distance)
      }
    } else if (chain.length === 1) {
      const tlen = Math.abs(chain[0]!.get('template_length') || 0)
      if (tlen > 0) {
        maxDistance = Math.max(maxDistance, tlen)
      }
    }
  }

  if (maxDistance === Number.MIN_VALUE) {
    maxDistance = DEFAULT_MAX_DISTANCE
  }

  const scale = createCloudScale(maxDistance, height)

  checkStopToken2(stopTokenCheck)

  // Allocate typed arrays
  const chainPositions = new Uint32Array(chains.length * 2)
  const chainYs = new Float32Array(chains.length)
  const chainFlags = new Uint16Array(chains.length)
  const chainColorTypes = new Uint8Array(chains.length)

  let chainIndex = 0
  for (const chain of chains) {
    if (chain.length === 0) {
      continue
    }

    // Get chain bounds
    let minStart = Number.MAX_VALUE
    let maxEnd = Number.MIN_VALUE
    for (const f of chain) {
      minStart = Math.min(minStart, f.get('start'))
      maxEnd = Math.max(maxEnd, f.get('end'))
    }

    // Calculate distance for y-position
    let distance = maxEnd - minStart
    if (chain.length === 1) {
      const tlen = Math.abs(chain[0]!.get('template_length') || 0)
      if (tlen > 0) {
        distance = tlen
      }
    }

    // Store position as offset from regionStart
    chainPositions[chainIndex * 2] = Math.floor(minStart - regionStart)
    chainPositions[chainIndex * 2 + 1] = Math.floor(maxEnd - regionStart)

    // Y position from log scale, normalized to 0-1
    const yPx = distance > 0 ? scale(distance) : 0
    chainYs[chainIndex] = yPx / (height - CLOUD_HEIGHT_PADDING)

    // Use first feature for flags and color
    const firstFeature = chain[0]!
    chainFlags[chainIndex] = firstFeature.get('flags') || 0
    chainColorTypes[chainIndex] = getColorType(firstFeature, stats)

    chainIndex++
  }

  return {
    regionStart,
    chainPositions: chainPositions.slice(0, chainIndex * 2),
    chainYs: chainYs.slice(0, chainIndex),
    chainFlags: chainFlags.slice(0, chainIndex),
    chainColorTypes: chainColorTypes.slice(0, chainIndex),
    numChains: chainIndex,
    maxDistance,
  }
}
