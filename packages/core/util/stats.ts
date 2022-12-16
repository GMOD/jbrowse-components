import { firstValueFrom, Observable } from 'rxjs'
import { reduce } from 'rxjs/operators'

// locals
import { NoAssemblyRegion } from './types'
import { Feature } from './simpleFeature'

export interface UnrectifiedFeatureStats {
  scoreMin: number
  scoreMax: number
  scoreSum: number
  scoreSumSquares: number
  featureCount: number
  basesCovered: number
}
export interface FeatureStats extends UnrectifiedFeatureStats {
  featureDensity: number
  scoreMean: number
  scoreStdDev: number
}

/**
 * calculate standard deviation using the 'shortcut method' that accepts
 * the sum and the sum squares of the elements
 *
 * @param sum - sum(i, 1..n)
 * @param sumSquares - sum(i^2, 1..n)
 * @param n - number of elements
 * @param population - boolean: use population instead of sample correction
 * @returns - the estimated std deviation
 */
export function calcStdFromSums(
  sum: number,
  sumSquares: number,
  n: number,
  population = false,
): number {
  if (n === 0) {
    return 0
  }
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

/**
 * @param stats - a summary stats object with scoreSum, featureCount,
 * scoreSumSquares, and basesCovered
 * @returns - a summary stats object with
 * scoreMean, scoreStdDev, and featureDensity added
 */
export function rectifyStats(s: UnrectifiedFeatureStats) {
  return {
    ...s,
    scoreMean: (s.scoreSum || 0) / (s.featureCount || s.basesCovered || 1),
    scoreStdDev: calcStdFromSums(
      s.scoreSum,
      s.scoreSumSquares,
      s.featureCount || s.basesCovered,
    ),
    featureDensity: (s.featureCount || 1) / s.basesCovered,
  } as FeatureStats
}

/**
 * calculates per-base scores for variable width features over a region
 *
 * @param region - object contains start, end
 * @param features - list of features with start, end, score
 * @returns array of numeric scores
 */
export function calcPerBaseStats(
  region: NoAssemblyRegion,
  features: Feature[],
): number[] {
  const { start, end } = region
  const scores = []
  const feats = features.sort((a, b) => a.get('start') - b.get('start'))
  let pos = start
  let currentFeat = 0
  let i = 0

  while (pos < end) {
    while (currentFeat < feats.length && pos >= feats[currentFeat].get('end')) {
      currentFeat += 1
    }
    const f = feats[currentFeat]
    if (!f) {
      scores[i] = 0
    } else if (pos >= f.get('start') && pos < f.get('end')) {
      scores[i] = f.get('score')
    } else {
      scores[i] = 0
    }
    i += 1
    pos += 1
  }
  return scores
}

/**
 * transform a list of scores to summary statistics
 *
 * @param region - object with start, end
 * @param features - array of features which are possibly summary features
 * @returns - object with scoreMax, scoreMin, scoreSum, scoreSumSquares, etc
 */
export async function scoresToStats(
  region: NoAssemblyRegion,
  feats: Observable<Feature>,
) {
  const { start, end } = region
  const seed = {
    scoreMin: Number.MAX_VALUE,
    scoreMax: Number.MIN_VALUE,
    scoreSum: 0,
    scoreSumSquares: 0,
    featureCount: 0,
  }
  let found = false

  const { scoreMin, scoreMax, scoreSum, scoreSumSquares, featureCount } =
    await firstValueFrom(
      feats.pipe(
        reduce((acc, f) => {
          const s = f.get('score')
          const summary = f.get('summary')
          const { scoreMax, scoreMin } = acc
          acc.scoreMax = Math.max(scoreMax, summary ? f.get('maxScore') : s)
          acc.scoreMin = Math.min(scoreMin, summary ? f.get('minScore') : s)
          acc.scoreSum += s
          acc.scoreSumSquares += s * s
          acc.featureCount += 1
          found = true

          return acc
        }, seed),
      ),
    )

  return found
    ? rectifyStats({
        scoreMax,
        scoreMin,
        scoreSum,
        scoreSumSquares,
        featureCount,
        basesCovered: end - start + 1,
      })
    : blankStats()
}

export function blankStats() {
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
  } as FeatureStats
}
