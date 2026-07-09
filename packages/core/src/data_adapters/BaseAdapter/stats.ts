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

// A sample window of `interval` bp centered ~25% into the region, so the sample
// avoids the region edges where coverage often tapers. Clamped to the region
// bounds so it never samples features outside the region being measured (the
// left edge clamps to the region start, not to the chromosome origin).
function sampleWindow(region: Region, interval: number) {
  const { start, end } = region
  const sampleCenter = start * 0.75 + end * 0.25
  return {
    start: Math.max(start, Math.round(sampleCenter - interval / 2)),
    end: Math.min(end, Math.round(sampleCenter + interval / 2)),
  }
}

// Cheap pre-fetch density estimate: sample a small window and grow it (doubling)
// until enough features are seen to be meaningful, then report features-per-bp
// over the bp actually sampled. Dense regions return after one tiny fetch;
// sparse regions expand until the window covers the whole region, bounded by a
// wall-clock timeout. Lets a display reject an unrenderably dense region before
// downloading the whole region's features.
export async function calculateFeatureDensityStats(
  region: Region,
  getFeatures: (region: Region, opts?: BaseOptions) => Observable<Feature>,
  opts?: BaseOptions,
): Promise<{ featureDensity: number }> {
  const refLen = region.end - region.start
  const t0 = performance.now()
  let interval = DENSITY_SAMPLE_INITIAL_INTERVAL

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const { start, end } = sampleWindow(region, interval)
    const sampledBp = end - start
    const features = await firstValueFrom(
      getFeatures({ ...region, start, end }, opts).pipe(toArray()),
    )

    // Enough features to be meaningful, or the window already spans the whole
    // region (growing further can't sample more) — report density over the bp
    // actually sampled, not the nominal interval.
    if (features.length >= DENSITY_SAMPLE_MIN_FEATURES || sampledBp >= refLen) {
      return { featureDensity: features.length / sampledBp }
    }

    // Sparse region or slow adapter: sampling ran past the time budget without
    // hitting the feature target. Report infinite density so the caller never
    // gates on a timed-out estimate and lets the full fetch decide.
    if (performance.now() - t0 > DENSITY_SAMPLE_TIMEOUT_MS) {
      console.warn(
        `[calculateFeatureDensityStats] gave up sampling density after ${(
          performance.now() - t0
        ).toFixed(0)}ms without reaching ${DENSITY_SAMPLE_MIN_FEATURES} features`,
      )
      return { featureDensity: Number.POSITIVE_INFINITY }
    }

    interval *= 2
  }
}

export { blankStats } from '../../util/stats.ts'
