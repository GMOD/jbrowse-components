import { type Observable, firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { max, min, sum } from '../../util/index.ts'
import { rectifyStats } from '../../util/stats.ts'

import type { BaseOptions } from './types.ts'
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
    featureCount: sum(stats.map(s => s.featureCount ?? 0)),
    basesCovered: sum(stats.map(s => s.basesCovered)),
    ...(meanMins.length > 0 ? { scoreMeanMin: min(meanMins) } : {}),
    ...(meanMaxs.length > 0 ? { scoreMeanMax: max(meanMaxs) } : {}),
  })
}

// Fetch features from a small window centered ~25% into the region, so the
// sample avoids the region edges where coverage often tapers.
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

// Cheap pre-fetch density estimate: sample a small window and grow it (doubling)
// until enough features are seen to be meaningful, then report features-per-bp.
// Dense regions return after one tiny fetch; sparse regions expand but are
// bounded by a timeout. Lets a display reject an unrenderably dense region
// before downloading the whole region's features.
export async function calculateFeatureDensityStats(
  region: Region,
  getFeatures: (region: Region, opts?: BaseOptions) => Observable<Feature>,
  opts?: BaseOptions,
): Promise<{ featureDensity: number }> {
  const refLen = region.end - region.start
  let interval = DENSITY_SAMPLE_INITIAL_INTERVAL
  let expansionTime = 0
  let lastTime = performance.now()
  const t0 = lastTime
  let rounds = 0

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    rounds++
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
        "[calculateFeatureDensityStats] timeout, or didn't get enough features",
        {
          totalRounds: rounds,
          totalElapsed: `${(performance.now() - t0).toFixed(0)}ms`,
        },
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
