import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

import type {
  ManhattanRegionData,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../RenderManhattanDataRPC/rpcTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ScoreStats } from '@jbrowse/wiggle-core'

export function encodeRegion(
  data: ManhattanRpcResult,
  colorAbgr: number,
): ManhattanRegionData {
  return {
    positions: data.positions,
    scores: data.scores,
    colors: new Uint32Array(data.numFeatures).fill(colorAbgr),
    numFeatures: data.numFeatures,
  }
}

export function aggregateScoreStats(
  regions: Iterable<ManhattanRpcResult>,
): ScoreStats | undefined {
  let scoreMin = Infinity
  let scoreMax = -Infinity
  let scoreSum = 0
  let scoreSumSq = 0
  let n = 0
  for (const d of regions) {
    if (d.scoreMin < scoreMin) {
      scoreMin = d.scoreMin
    }
    if (d.scoreMax > scoreMax) {
      scoreMax = d.scoreMax
    }
    scoreSum += d.scoreSum
    scoreSumSq += d.scoreSumSq
    n += d.numFeatures
  }
  if (n === 0 || scoreMin > scoreMax) {
    return undefined
  }
  const scoreMean = scoreSum / n
  return {
    scoreMin,
    scoreMax,
    scoreMean,
    scoreStdDev: Math.sqrt(Math.max(0, scoreSumSq / n - scoreMean * scoreMean)),
  }
}

export function makeManhattanRenderState({
  domain,
  view,
  height,
  scaleType,
}: {
  domain: [number, number] | undefined
  view: LinearGenomeViewModel
  height: number
  scaleType: string
}): ManhattanRenderState | undefined {
  return domain
    ? {
        domainY: domain,
        scaleType: scaleType === 'log' ? 1 : 0,
        canvasWidth: view.trackWidthPx,
        canvasHeight: height - 2 * YSCALEBAR_LABEL_OFFSET,
        pointRadius: 2,
      }
    : undefined
}
