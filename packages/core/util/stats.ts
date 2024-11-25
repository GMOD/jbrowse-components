import { firstValueFrom } from 'rxjs'
import { reduce } from 'rxjs/operators'

// locals
import type { Feature } from './simpleFeature'
import type { NoAssemblyRegion } from './types'
import type { Observable } from 'rxjs'

export interface UnrectifiedQuantitativeStats {
  scoreMin: number
  scoreMax: number
  scoreSum: number
  scoreSumSquares: number
  featureCount: number
  basesCovered: number
}
export interface QuantitativeStats extends UnrectifiedQuantitativeStats {
  currStatsBpPerPx: number
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
  let variance: number
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
export function rectifyStats(s: UnrectifiedQuantitativeStats) {
  return {
    ...s,
    scoreMean: (s.scoreSum || 0) / (s.featureCount || s.basesCovered || 1),
    scoreStdDev: calcStdFromSums(
      s.scoreSum,
      s.scoreSumSquares,
      s.featureCount || s.basesCovered,
    ),
    featureDensity: (s.featureCount || 1) / s.basesCovered,
  } as QuantitativeStats
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
  } as QuantitativeStats
}
