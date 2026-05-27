import {
  findFeatureAtBp,
  summaryFields,
} from '../../shared/wiggleComponentUtils.ts'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
import type { WiggleSourceData } from '../../util.ts'

type FeatureUnderMouse = NonNullable<WiggleDisplayModel['featureUnderMouse']>

export function findHit(
  source: WiggleSourceData,
  bp: number,
  refName: string,
  summaryScoreMode: string,
): FeatureUnderMouse | undefined {
  const { featurePositions, featureScores, numFeatures } = source
  const i = findFeatureAtBp(featurePositions, numFeatures, bp)
  if (i === -1) {
    return undefined
  }
  const score = featureScores[i]!
  return {
    refName,
    start: featurePositions[i * 2]!,
    end: featurePositions[i * 2 + 1]!,
    score,
    ...summaryFields(
      score,
      source.featureMinScores[i],
      source.featureMaxScores[i],
      summaryScoreMode,
    ),
  }
}
