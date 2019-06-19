import { Feature as BBIFeature } from '@gmod/bbi'
import { INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'

export interface UnrectifiedFeatureStats {
  scoreMin: number
  scoreMax: number
  scoreSum: number
  scoreSumSquares: number
  featureCount: number
  basesCovered: number
}
export interface FeatureStats extends UnrectifiedFeatureStats {
  scoreMean: number
  scoreStdDev: number
  featureDensity: number
}
/*
 * calculate standard deviation using the 'shortcut method' that accepts
 * the sum and the sum squares of the elements
 *
 * @param sum - sum(i, 1..n)
 * @param sumSquares - sum(i^2, 1..n)
 * @param n - number of elements
 * @param population - boolean: use population instead of sample correction
 * @return the estimated std deviation
 */

export function calcStdFromSums(
  sum: number,
  sumSquares: number,
  n: number,
  population: boolean = false,
): number {
  if (n === 0) return 0
  let variance
  if (population) {
    variance = sumSquares / n - (sum * sum) / (n * n)
  } else {
    // sample correction is n-1
    variance = sumSquares - (sum * sum) / n
    if (n > 1) {
      variance /= n - 1
    }
  }

  return variance < 0 ? 0 : Math.sqrt(variance)
}

/*
 * @param stats - a summary stats object with scoreSum, featureCount, scoreSumSquares, and basesCovered
 * @return - a summary stats object with scoreMean, scoreStdDev, and featureDensity added
 */
export function rectifyStats(s: UnrectifiedFeatureStats): FeatureStats {
  return {
    ...s,
    scoreMean: s.featureCount ? s.scoreSum / s.featureCount : 0,
    scoreStdDev: calcStdFromSums(
      s.scoreSum,
      s.scoreSumSquares,
      s.featureCount || 0,
    ),
    featureDensity: (s.featureCount || 0) / s.basesCovered,
  }
}

/*
 * calculates per-base scores for variable width features over a region
 * @param region - object contains start, end
 * @param features - list of features with start, end, score
 * @return array of numeric scores
 */
export function calcRealStats(
  region: { start: number; end: number },
  features: BBIFeature[],
  opts: { windowSize: number },
): number[] {
  const { start, end } = region
  const scores = []
  const feats = features.sort((a, b) => a.start - b.start)
  let pos = start
  let currentFeat = 0
  let i = 0
  while (pos < end) {
    while (currentFeat < feats.length && pos >= feats[currentFeat].end) {
      currentFeat += 1
    }
    const f = feats[currentFeat]
    // console.log('currentPos', pos, currentFeat)
    if (!f) {
      scores[i] = 0
    } else if (pos >= f.start && pos < f.end) {
      scores[i] = f.score
    } else {
      scores[i] = 0
    }
    i += 1
    pos += 1
  }
  return scores
}

/*
 * transform a list of scores to summary statistics
 * @param region - object with start, end
 * @param feats - array of features which are possibly summary features
 * @return - object with scoreMax, scoreMin, scoreSum, scoreSumSquares, etc
 */
export function scoresToStats(
  region: INoAssemblyRegion,
  feats: BBIFeature[],
): FeatureStats {
  const { start, end } = region
  let scoreMax = -Infinity
  let scoreMin = Infinity
  let scoreSum = 0
  let scoreSumSquares = 0

  for (let i = 0; i < feats.length; i += 1) {
    const f = feats[i]
    // @ts-ignore todo make "summary feature type" in bbi-js
    scoreMax = Math.max(scoreMax, f.summary ? f.maxScore : f.score)
    // @ts-ignore todo make "summary feature type" in bbi-js
    scoreMin = Math.min(scoreMin, f.summary ? f.minScore : f.score)
    scoreSum += f.score
    scoreSumSquares += f.score * f.score
  }

  return rectifyStats({
    scoreMax,
    scoreMin,
    scoreSum,
    scoreSumSquares,
    featureCount: feats.length,
    basesCovered: end - start + 1,
  })
}

export function blankStats(): FeatureStats {
  return {
    scoreMin: 0,
    scoreMax: 0,
    scoreMean: 0,
    scoreStdDev: 0,
    scoreSum: 0,
    scoreSumSquares: 0,
    featureCount: 0,
    featureDensity: 0,
    basesCovered: 0,
  }
}
