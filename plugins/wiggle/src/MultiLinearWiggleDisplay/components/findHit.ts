import {
  findFeatureAtBp,
  isSummaryFeature,
} from '../../shared/wiggleComponentUtils.ts'

import type { MultiWiggleDisplayModel } from './MultiWiggleComponent.tsx'
import type { WiggleDataResult, WiggleSourceData } from '../../util.ts'

type FeatureUnderMouse = NonNullable<
  MultiWiggleDisplayModel['featureUnderMouse']
>

function summaryFields(
  score: number,
  minScore: number | undefined,
  maxScore: number | undefined,
  summaryScoreMode: string,
) {
  return summaryScoreMode !== 'avg' &&
    isSummaryFeature(score, minScore, maxScore)
    ? { summary: true as const, minScore, maxScore }
    : {}
}

// Overlay mode: every visible source's score at the cursor bp is collected
// and returned as `allSources`. Tooltip header coord is the cursor bp itself
// — picking one source's feature interval would be arbitrary across sources
// with different bin widths.
export function findOverlayHit(
  data: WiggleDataResult,
  visibleSources: { name: string }[],
  bp: number,
  refName: string,
  summaryScoreMode: string,
): FeatureUnderMouse | undefined {
  const visible = new Set(visibleSources.map(s => s.name))
  const allSources: NonNullable<FeatureUnderMouse['allSources']> = []
  for (const src of data.sources) {
    if (visible.has(src.name)) {
      const i = findFeatureAtBp(src.featurePositions, src.numFeatures, bp)
      if (i !== -1) {
        const score = src.featureScores[i]!
        allSources.push({
          source: src.name,
          score,
          ...summaryFields(
            score,
            src.featureMinScores[i],
            src.featureMaxScores[i],
            summaryScoreMode,
          ),
        })
      }
    }
  }
  if (allSources.length === 0) {
    return undefined
  }
  return {
    refName,
    start: bp,
    end: bp,
    score: 0,
    source: '',
    allSources,
  }
}

// Row mode: cursor Y picks one row → one source. Returns its feature interval.
export function findRowHit(
  data: WiggleDataResult,
  visibleSources: { name: string }[],
  bp: number,
  offsetY: number,
  rowHeight: number,
  refName: string,
  summaryScoreMode: string,
): FeatureUnderMouse | undefined {
  const rowIdx = Math.floor(offsetY / rowHeight)
  if (rowIdx < 0 || rowIdx >= visibleSources.length) {
    return undefined
  }
  const sourceName = visibleSources[rowIdx]!.name
  const rpcSource: WiggleSourceData | undefined = data.sources.find(
    s => s.name === sourceName,
  )
  if (!rpcSource) {
    return undefined
  }
  const foundIdx = findFeatureAtBp(
    rpcSource.featurePositions,
    rpcSource.numFeatures,
    bp,
  )
  if (foundIdx === -1) {
    return undefined
  }
  const score = rpcSource.featureScores[foundIdx]!
  return {
    refName,
    start: rpcSource.featurePositions[foundIdx * 2]!,
    end: rpcSource.featurePositions[foundIdx * 2 + 1]!,
    score,
    source: sourceName,
    ...summaryFields(
      score,
      rpcSource.featureMinScores[foundIdx],
      rpcSource.featureMaxScores[foundIdx],
      summaryScoreMode,
    ),
  }
}
