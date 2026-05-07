import {
  findFeatureAtBp,
  isSummaryFeature,
} from '../../shared/wiggleComponentUtils.ts'

import type { WiggleDisplayModel } from './buildSourceRenderData.ts'
import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'

type FeatureUnderMouse = NonNullable<WiggleDisplayModel['featureUnderMouse']>

export function findHit(
  data: WiggleDataResult,
  bp: number,
  refName: string,
  summaryScoreMode: string,
): FeatureUnderMouse | undefined {
  const { featurePositions, featureScores, numFeatures } = data
  const i = findFeatureAtBp(featurePositions, numFeatures, bp)
  if (i === -1) {
    return undefined
  }
  const score = featureScores[i]!
  const minScore = data.featureMinScores[i]
  const maxScore = data.featureMaxScores[i]
  return {
    refName,
    start: featurePositions[i * 2]!,
    end: featurePositions[i * 2 + 1]!,
    score,
    ...(summaryScoreMode !== 'avg' &&
    isSummaryFeature(score, minScore, maxScore)
      ? { summary: true as const, minScore, maxScore }
      : {}),
  }
}
