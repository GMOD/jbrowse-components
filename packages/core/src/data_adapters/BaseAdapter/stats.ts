import { type Observable, firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { max, min, sum } from '../../util/index.ts'
import { rectifyStats } from '../../util/stats.ts'

import type { BaseOptions } from './BaseOptions.ts'
import type { FeatureDensityStats } from './types.ts'
import type { Feature } from '../../util/simpleFeature.ts'
import type { RectifiedQuantitativeStats } from '../../util/stats.ts'
import type { AugmentedRegion as Region } from '../../util/types/index.ts'

const DENSITY_SAMPLE_INITIAL_INTERVAL = 1000
const DENSITY_SAMPLE_MIN_FEATURES = 70
const DENSITY_SAMPLE_TIMEOUT_MS = 5000

export function aggregateQuantitativeStats(
  stats: RectifiedQuantitativeStats[],
) {
  const meanMins = stats.map(s => s.scoreMeanMin).filter(s => s !== undefined)
  const meanMaxs = stats.map(s => s.scoreMeanMax).filter(s => s !== undefined)
  return rectifyStats({
    scoreMax: max(stats.map(s => s.scoreMax)),
    scoreMin: min(stats.map(s => s.scoreMin)),
    scoreSum: sum(stats.map(s => s.scoreSum)),
    scoreSumSquares: sum(stats.map(s => s.scoreSumSquares)),
    featureCount: sum(stats.map(s => s.featureCount)),
    basesCovered: sum(stats.map(s => s.basesCovered)),
    ...(meanMins.length > 0 ? { scoreMeanMin: min(meanMins) } : {}),
    ...(meanMaxs.length > 0 ? { scoreMeanMax: max(meanMaxs) } : {}),
  })
}

export function sampleFeaturesForInterval(
  region: Region,
  interval: number,
  getFeatures: (region: Region, opts?: BaseOptions) => Observable<Feature>,
  opts?: BaseOptions,
) {
  const { start, end } = region
  const sampleCenter = start * 0.75 + end * 0.25
  return firstValueFrom(
    getFeatures(
      {
        ...region,
        start: Math.max(0, Math.round(sampleCenter - interval / 2)),
        end: Math.min(Math.round(sampleCenter + interval / 2), end),
      },
      opts,
    ).pipe(toArray()),
  )
}

export async function calculateFeatureDensityStats(
  region: Region,
  getFeatures: (region: Region, opts?: BaseOptions) => Observable<Feature>,
  opts?: BaseOptions,
): Promise<FeatureDensityStats> {
  const refLen = region.end - region.start
  let interval = DENSITY_SAMPLE_INITIAL_INTERVAL
  let expansionTime = 0
  let lastTime = performance.now()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const features = await sampleFeaturesForInterval(
      region,
      interval,
      getFeatures,
      opts,
    )
    const featureCount = features.length

    if (featureCount >= DENSITY_SAMPLE_MIN_FEATURES || interval * 2 > refLen) {
      return { featureDensity: featureCount / interval }
    }

    if (expansionTime > DENSITY_SAMPLE_TIMEOUT_MS) {
      console.warn(
        "Stats estimation reached timeout, or didn't get enough features",
      )
      return { featureDensity: Number.POSITIVE_INFINITY }
    }

    const currTime = performance.now()
    expansionTime += currTime - lastTime
    lastTime = currTime
    interval *= 2
  }
}

export { blankStats } from '../../util/stats.ts'
