import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, groupBy, max, min } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { featurizeSA, getTag } from '../MismatchParser/index.ts'
import {
  extractCoreFeat,
  filterAndSortLongReadChain,
  filterPairedChain,
  getMateInfo,
  getStrandRelativeFirstClipLength,
  toCoreFeat,
  toCoreFeatBasic,
} from '../shared/arcUtils.ts'
import { PairType, getPairedType } from '../shared/color.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'
import { SAM_FLAG_MATE_UNMAPPED } from '../shared/samFlags.ts'
import { hasPairedReads } from '../shared/util.ts'

import type { WebGLArcsDataResult } from './types.ts'
import type { CoreFeat } from '../shared/arcUtils.ts'
import type { ChainStats, ColorBy } from '../shared/types.ts'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    sequenceAdapter?: Record<string, unknown>
    region: Region
    filterBy?: Record<string, unknown>
    colorBy: ColorBy
    height: number
    drawInter: boolean
    drawLongRange: boolean
  }
}

// Arc rendering thresholds
const ARC_VS_BEZIER_THRESHOLD = 10_000
const VERTICAL_LINE_THRESHOLD = 100_000

interface ChainData {
  chains: Feature[][]
  stats?: ChainStats
}

function getColorType(
  k1: CoreFeat,
  s1: number,
  s2: number,
  absrad: number,
  hasPaired: boolean,
  colorByType: string,
  stats?: ChainStats,
  longRange?: boolean,
  drawArcInsteadOfBezier?: boolean,
): number {
  // Long range arcs drawn as actual arcs are red (type 1)
  if (longRange && drawArcInsteadOfBezier) {
    return 1 // red
  }

  if (hasPaired) {
    const pairType = getPairedType({
      type: 'insertSizeAndOrientation',
      f: {
        refName: k1.refName,
        next_ref: k1.next_ref,
        pair_orientation: k1.pair_orientation,
        tlen: k1.tlen,
        flags: 0,
      },
      stats,
    })

    if (
      colorByType === 'insertSizeAndOrientation' ||
      colorByType === 'insertSize'
    ) {
      switch (pairType) {
        case PairType.LONG_INSERT:
          return 1 // red
        case PairType.SHORT_INSERT:
          return 2 // blue
        case PairType.INTER_CHROM:
          return 3 // purple
        case PairType.ABNORMAL_ORIENTATION:
          return 4 // green
        default:
          return 0 // grey
      }
    }
    if (colorByType === 'orientation') {
      if (pairType === PairType.ABNORMAL_ORIENTATION) {
        return 4
      }
      return 0
    }
    if (colorByType === 'gradient') {
      return 5 // gradient
    }
    return 0
  }

  // Long-read coloring
  if (colorByType === 'orientation' || colorByType === 'insertSizeAndOrientation') {
    if (s1 === -1 && s2 === 1) {
      return 4 // navy -> using green
    }
    if (s1 === 1 && s2 === -1) {
      return 4 // green
    }
    return 0
  }
  if (colorByType === 'gradient') {
    return 5
  }
  return 0
}

function getArcEndpoint(
  feat: CoreFeat,
  isPairedEnd: boolean,
  isMate: boolean,
): number {
  const isReverse = feat.strand === -1
  if (isPairedEnd) {
    return isReverse ? feat.start : feat.end
  }
  return isMate
    ? isReverse
      ? feat.end
      : feat.start
    : isReverse
      ? feat.start
      : feat.end
}

export async function executeRenderWebGLArcsData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLArcsDataResult> {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    colorBy,
    height,
    drawInter,
    drawLongRange,
  } = args

  // Get adapter
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
    dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
  }

  // Fetch features
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeaturesInMultipleRegions([region], args).pipe(toArray()),
  )

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

  const chains = Object.values(groupBy(deduped, f => f.get('name')))
  const chainData: ChainData = { chains, stats }
  const hasPaired = hasPairedReads(chainData)

  const regionStart = region.start
  const colorByType = colorBy.type || 'insertSizeAndOrientation'

  // Collect compact per-arc data (curve computed on GPU)
  const arcX1s: number[] = []
  const arcX2s: number[] = []
  const arcColorTypes: number[] = []
  const arcIsArcs: number[] = []

  const lineData: {
    positions: number[]
    ys: number[]
    colorTypes: number[]
  } = {
    positions: [],
    ys: [],
    colorTypes: [],
  }

  function processArc(k1: CoreFeat, k2: CoreFeat, longRange: boolean) {
    const s1 = k1.strand
    const s2 = k2.strand

    const p1 = getArcEndpoint(k1, hasPaired, false)
    const p2 = getArcEndpoint(k2, hasPaired, true)

    // Both points must be on the same chromosome (we can only draw arcs within region)
    if (k1.refName !== k2.refName) {
      // Inter-chromosomal - draw vertical line at p1
      if (drawInter) {
        const xOffset = p1 - regionStart
        lineData.positions.push(xOffset, xOffset)
        lineData.ys.push(0, height)
        lineData.colorTypes.push(0, 0) // purple
      }
      return
    }

    const radius = (p2 - p1) / 2
    const absrad = Math.abs(radius)
    const drawArcInsteadOfBezier = absrad > ARC_VS_BEZIER_THRESHOLD

    const colorType = getColorType(
      k1,
      s1,
      s2,
      absrad,
      hasPaired,
      colorByType,
      stats,
      longRange,
      drawArcInsteadOfBezier,
    )

    if (absrad < 1) {
      // Very small - still send as arc record (will render as tiny curve)
      arcX1s.push(p1 - regionStart)
      arcX2s.push(p2 - regionStart)
      arcColorTypes.push(colorType)
      arcIsArcs.push(0)
    } else if (longRange && absrad > VERTICAL_LINE_THRESHOLD) {
      // Very large - draw vertical lines
      if (drawLongRange) {
        const x1Offset = p1 - regionStart
        const x2Offset = p2 - regionStart
        lineData.positions.push(x1Offset, x1Offset)
        lineData.ys.push(0, height)
        lineData.colorTypes.push(1, 1) // red
        lineData.positions.push(x2Offset, x2Offset)
        lineData.ys.push(0, height)
        lineData.colorTypes.push(1, 1) // red
      }
    } else if (longRange && drawArcInsteadOfBezier) {
      // Large arc - use semicircle (isArc=1)
      arcX1s.push(p1 - regionStart)
      arcX2s.push(p2 - regionStart)
      arcColorTypes.push(colorType)
      arcIsArcs.push(1)
    } else {
      // Normal bezier curve (isArc=0)
      arcX1s.push(p1 - regionStart)
      arcX2s.push(p2 - regionStart)
      arcColorTypes.push(colorType)
      arcIsArcs.push(0)
    }
  }

  function processSingletonPairedEnd(f: Feature) {
    processArc(extractCoreFeat(f), getMateInfo(f), true)
  }

  function processSingletonLongRead(f: Feature) {
    const allFeatures = [
      f,
      ...featurizeSA(getTag(f, 'SA'), f.id(), f.get('strand'), f.get('name')),
    ].toSorted(
      (a, b) =>
        getStrandRelativeFirstClipLength(a) -
        getStrandRelativeFirstClipLength(b),
    )

    for (let i = 0, len = allFeatures.length; i < len - 1; i++) {
      processArc(
        toCoreFeat(allFeatures[i]!),
        toCoreFeatBasic(allFeatures[i + 1]!),
        true,
      )
    }
  }

  function processMultiFeatureChain(chain: Feature[]) {
    const filtered = hasPaired
      ? filterPairedChain(chain)
      : filterAndSortLongReadChain(chain)

    for (let i = 0, len = filtered.length; i < len - 1; i++) {
      processArc(
        extractCoreFeat(filtered[i]!),
        extractCoreFeat(filtered[i + 1]!),
        false,
      )
    }
  }

  for (const chain of chains) {
    if (chain.length === 1 && drawLongRange) {
      const f = chain[0]!
      const isMateUnmapped = f.get('flags') & SAM_FLAG_MATE_UNMAPPED

      if (hasPaired && !isMateUnmapped) {
        processSingletonPairedEnd(f)
      } else {
        processSingletonLongRead(f)
      }
    } else {
      processMultiFeatureChain(chain)
    }
  }

  return {
    regionStart,
    arcX1: new Float32Array(arcX1s),
    arcX2: new Float32Array(arcX2s),
    arcColorTypes: new Float32Array(arcColorTypes),
    arcIsArc: new Uint8Array(arcIsArcs),
    numArcs: arcX1s.length,
    linePositions: new Uint32Array(lineData.positions),
    lineYs: new Float32Array(lineData.ys),
    lineColorTypes: new Float32Array(lineData.colorTypes),
    numLines: lineData.positions.length / 2,
  }
}
