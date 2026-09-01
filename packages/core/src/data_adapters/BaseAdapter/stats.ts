import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { max, min, sum } from '../../util/index.ts'
import { rectifyStats } from '../../util/stats.ts'

import type { Feature } from '../../util/simpleFeature.ts'
import type { RectifiedQuantitativeStats } from '../../util/stats.ts'
import type { AugmentedRegion as Region } from '../../util/types/index.ts'
import type { BaseOptions } from './types.ts'
import type { Observable } from 'rxjs'

const DENSITY_SAMPLE_INITIAL_INTERVAL = 1000
const DENSITY_SAMPLE_MIN_FEATURES = 70
const DENSITY_SAMPLE_TIMEOUT_MS = 5000

/**
 * What a caller that will *judge* the density knows and the probe does not: how
 * wide a window has to be before its count can settle that judgement, and when
 * a count has settled it. Supplying it turns the ladder below from "grow until
 * the estimate is precise" into "grow until the verdict is decided", which at
 * whole-genome zoom is one window instead of thirteen.
 *
 * The probe stays ignorant of what the budget means — `plugins/canvas`'s
 * `densityProbeGate` owns both numbers, so the comparison that refuses a region
 * lives beside the one the banner re-derives rather than in a second copy here.
 */
export interface DensityProbeGate {
  /** First window to sample: the narrowest one whose count can settle it. */
  initialInterval: number
  /** Whether this many admitted features in this many bp decides the verdict. */
  settled: (admitted: number, sampledBp: number) => boolean
}

/**
 * The adapter options a probe forwards, plus the two things only its caller
 * knows. Named rather than trailing positionals: `BaseOptions` has no required
 * member, so every one of its slots structurally accepts anything, and an
 * `admit` handed to the `opts` slot typechecks and then never filters.
 */
export interface DensityProbeOptions extends BaseOptions {
  /**
   * The caller's feature-admission predicate (config filters, type gates, ...).
   * See the note on the growth/report asymmetry below.
   */
  admit?: (feature: Feature) => boolean
  /** Stop as soon as the verdict is decided rather than when it is precise. */
  gate?: DensityProbeGate
}

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
//
// `admit` is the caller's feature-admission predicate (config filters, type
// gates, ...). When given, the reported density counts only admitted features,
// so a caller that filters before drawing gates on the population it will
// actually render rather than the raw one — without it, a filtered view gets
// rejected on features it was never going to draw.
//
// Note the asymmetry, and keep it: the *window growth* below tests the raw
// count while the *density* reports the admitted count. Growing on the admitted
// count would make a selective filter double the window over and over until it
// spanned the whole region — turning the cheap pre-fetch probe into a second
// full download for exactly the views that need it most.
export async function calculateFeatureDensityStats(
  region: Region,
  getFeatures: (region: Region, opts?: BaseOptions) => Observable<Feature>,
  { admit, gate, ...opts }: DensityProbeOptions = {},
): Promise<{ featureDensity: number }> {
  const refLen = region.end - region.start
  const t0 = performance.now()
  let interval = Math.max(
    DENSITY_SAMPLE_INITIAL_INTERVAL,
    gate?.initialInterval ?? 0,
  )

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const { start, end } = sampleWindow(region, interval)
    const sampledBp = end - start
    const features = await firstValueFrom(
      getFeatures({ ...region, start, end }, opts).pipe(toArray()),
    )
    const admitted = admit ? features.filter(admit).length : features.length

    // The verdict is already decided by a margin, so a precise density would
    // only make it more decided. Tested on the admitted count, which is the
    // population the caller judges — the raw count below governs window growth
    // for the reason in the note above, and the two must not be swapped.
    if (gate?.settled(admitted, sampledBp)) {
      return { featureDensity: admitted / sampledBp }
    }

    // Enough features to be meaningful, or the window already spans the whole
    // region (growing further can't sample more) — report density over the bp
    // actually sampled, not the nominal interval.
    if (features.length >= DENSITY_SAMPLE_MIN_FEATURES || sampledBp >= refLen) {
      return { featureDensity: admitted / sampledBp }
    }

    // Sparse region or slow adapter: sampling ran past the time budget without
    // hitting the feature target. Report infinite density so the caller never
    // gates on a timed-out estimate and lets the full fetch decide.
    if (performance.now() - t0 > DENSITY_SAMPLE_TIMEOUT_MS) {
      console.warn(
        `[calculateFeatureDensityStats] gave up sampling density after ${(
          performance.now() - t0
        ).toFixed(
          0,
        )}ms without reaching ${DENSITY_SAMPLE_MIN_FEATURES} features`,
      )
      return { featureDensity: Number.POSITIVE_INFINITY }
    }

    interval *= 2
  }
}

export { blankStats } from '../../util/stats.ts'
