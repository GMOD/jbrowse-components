import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { NoAssemblyRegion, Region } from '@gmod/jbrowse-core/util/types'
import { Observable } from 'rxjs'
import { reduce } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'

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
  population = false,
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
    scoreMean: (s.scoreSum || 0) / (s.featureCount || s.basesCovered || 1),
    scoreStdDev: calcStdFromSums(
      s.scoreSum,
      s.scoreSumSquares,
      s.featureCount || s.basesCovered,
    ),
    featureDensity: (s.featureCount || 1) / s.basesCovered,
  }
}

/*
 * calculates per-base scores for variable width features over a region
 * @param region - object contains start, end
 * @param features - list of features with start, end, score
 * @return array of numeric scores
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

/*
 * transform a list of scores to summary statistics
 * @param region - object with start, end
 * @param feats - array of features which are possibly summary features
 * @return - object with scoreMax, scoreMin, scoreSum, scoreSumSquares, etc
 */
export async function scoresToStats(
  region: NoAssemblyRegion,
  features: Observable<Feature>,
): Promise<FeatureStats> {
  const { start, end } = region

  const {
    scoreMin,
    scoreMax,
    scoreSum,
    scoreSumSquares,
    featureCount,
  } = await features
    .pipe(
      reduce(
        (
          seed: {
            scoreMin: number
            scoreMax: number
            scoreSum: number
            scoreSumSquares: number
            featureCount: number
          },
          f: Feature,
        ) => {
          const score = f.get('score')
          seed.scoreMax = Math.max(
            seed.scoreMax,
            f.get('summary') ? f.get('maxScore') : score,
          )
          seed.scoreMin = Math.min(
            seed.scoreMin,
            f.get('summary') ? f.get('minScore') : score,
          )
          seed.scoreSum += score
          seed.scoreSumSquares += score * score
          seed.featureCount += 1

          return seed
        },
        {
          scoreMin: Number.MAX_VALUE,
          scoreMax: Number.MIN_VALUE,
          scoreSum: 0,
          scoreSumSquares: 0,
          featureCount: 0,
        },
      ),
    )
    .toPromise()

  return rectifyStats({
    scoreMax,
    scoreMin,
    scoreSum,
    scoreSumSquares,
    featureCount,
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

export interface DataAdapterWithGlobalStats extends BaseFeatureDataAdapter {
  getGlobalStats(args: {
    signal?: AbortSignal
    headers?: Record<string, string>
  }): Promise<FeatureStats>
}

export function dataAdapterSupportsGlobalStats(
  adapter: BaseFeatureDataAdapter,
): adapter is DataAdapterWithGlobalStats {
  return 'getGlobalStats' in adapter
}

export interface DataAdapterWithMultiRegionStats
  extends BaseFeatureDataAdapter {
  getMultiRegionStats(
    regions: Region[],
    args: {
      signal?: AbortSignal
      bpPerPx: number
      headers?: Record<string, string>
    },
  ): Promise<FeatureStats>
}

export function dataAdapterSupportsMultiRegionStats(
  adapter: BaseFeatureDataAdapter,
): adapter is DataAdapterWithMultiRegionStats {
  return 'getMultiRegionStats' in adapter
}
