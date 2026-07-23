import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/index.ts'
import {
  FORCE_LOAD_HEADROOM,
  TOO_MANY_FEATURES_REASON,
  bytesTooLargeReason,
  evaluateRegionTooLarge,
  forceLoadByteLimit,
  raiseLimitPast,
  rescaleByteEstimateToVisibleSpan,
  resolveByteLimit,
  resolveForceLoadLimits,
} from './regionTooLargeUtils.ts'

describe('raiseLimitPast', () => {
  it('raises the limit past the estimate by the shared headroom, rounded up', () => {
    expect(raiseLimitPast(1_000_000)).toBe(
      Math.ceil(1_000_000 * FORCE_LOAD_HEADROOM),
    )
    expect(raiseLimitPast(3)).toBe(Math.ceil(3 * FORCE_LOAD_HEADROOM))
  })

  it('always returns strictly more than the estimate so a re-check clears', () => {
    for (const estimate of [1, 100, 5_000_000]) {
      expect(raiseLimitPast(estimate)).toBeGreaterThan(estimate)
    }
  })
})

describe('forceLoadByteLimit', () => {
  it('is undefined when neither estimate is available', () => {
    expect(
      forceLoadByteLimit({
        estimatedBytesForVisibleSpan: undefined,
        estimatedBytesForMeasuredSpan: undefined,
      }),
    ).toBeUndefined()
    // an adapter with no index estimate reports 0, which is not a budget
    expect(
      forceLoadByteLimit({
        estimatedBytesForVisibleSpan: 0,
        estimatedBytesForMeasuredSpan: 0,
      }),
    ).toBeUndefined()
  })

  it('raises past the visible-span estimate, not the measured-span one (the LD force-load bug)', () => {
    // view zoomed out after the measurement: the visible-span estimate (6MB)
    // far exceeds the measured-span one (1.5MB). Basing the limit on the
    // measured-span number would under-raise and leave the banner up.
    expect(
      forceLoadByteLimit({
        estimatedBytesForVisibleSpan: 6_000_000,
        estimatedBytesForMeasuredSpan: 1_500_000,
      }),
    ).toBe(raiseLimitPast(6_000_000))
  })

  it('falls back to the measured-span estimate when there is no visible-span one', () => {
    expect(
      forceLoadByteLimit({
        estimatedBytesForVisibleSpan: undefined,
        estimatedBytesForMeasuredSpan: 900,
      }),
    ).toBe(raiseLimitPast(900))
  })
})

describe('resolveForceLoadLimits', () => {
  const base = {
    baselineByteLimit: 5_000_000,
    densityGateActive: true,
    observedMaxDensity: 4,
    configuredMaxDensity: 1,
  }

  it('raises the byte axis when the estimate genuinely exceeds the baseline', () => {
    const { userByteLimit, userFeatureDensityLimit } = resolveForceLoadLimits({
      ...base,
      estimatedBytesForVisibleSpan: 8_000_000,
      estimatedBytesForMeasuredSpan: 8_000_000,
    })
    expect(userByteLimit).toBe(raiseLimitPast(8_000_000))
    expect(userFeatureDensityLimit).toBeUndefined()
  })

  // The core "don't lower the ceiling" guard: a density-gated tabix region
  // carries a small byte estimate under the baseline. Raising the byte ceiling
  // to 1.5× that would install a limit BELOW the baseline and gate later,
  // larger-byte regions — so the byte axis is skipped and density is raised.
  it('raises density (not bytes) when the byte estimate is under the baseline', () => {
    const { userByteLimit, userFeatureDensityLimit } = resolveForceLoadLimits({
      ...base,
      estimatedBytesForVisibleSpan: 100_000,
      estimatedBytesForMeasuredSpan: 100_000,
    })
    expect(userByteLimit).toBeUndefined()
    expect(userFeatureDensityLimit).toBe(raiseLimitPast(4)) // past observedMax
  })

  it('raises past the configured density when nothing is observed yet', () => {
    const { userFeatureDensityLimit } = resolveForceLoadLimits({
      ...base,
      observedMaxDensity: 0,
      estimatedBytesForVisibleSpan: undefined,
      estimatedBytesForMeasuredSpan: undefined,
    })
    expect(userFeatureDensityLimit).toBe(raiseLimitPast(1)) // configuredMaxDensity
  })

  it('raises nothing when neither axis is gating (no bytes, density inactive)', () => {
    expect(
      resolveForceLoadLimits({
        ...base,
        densityGateActive: false,
        estimatedBytesForVisibleSpan: undefined,
        estimatedBytesForMeasuredSpan: undefined,
      }),
    ).toEqual({})
  })
})

describe('resolveByteLimit', () => {
  it('prefers the user force-load override over everything', () => {
    expect(
      resolveByteLimit({
        userByteLimit: 10,
        adapterFetchSizeLimit: 20,
        configFetchSizeLimit: 30,
      }),
    ).toBe(10)
  })

  it('falls back to the adapter limit when there is no user override', () => {
    expect(
      resolveByteLimit({
        adapterFetchSizeLimit: 20,
        configFetchSizeLimit: 30,
      }),
    ).toBe(20)
  })

  it('falls back to the config default when no override or adapter limit', () => {
    expect(resolveByteLimit({ configFetchSizeLimit: 30 })).toBe(30)
  })

  // Regression: an adapter reporting fetchSizeLimit: 0 (e.g. htsget/no-index)
  // means "no opinion" — without the guard a 0 limit gates every request as
  // too-large. 0 must be skipped so the config default applies.
  it('treats an adapter limit of 0 as absent, not a zero budget', () => {
    expect(
      resolveByteLimit({
        adapterFetchSizeLimit: 0,
        configFetchSizeLimit: 30,
      }),
    ).toBe(30)
  })

  // Regression: a negative adapter sentinel (-1) is truthy, so `|| undefined`
  // let it survive and gate every request as too-large. Only a positive adapter
  // limit is an opinion.
  it('treats a negative adapter limit as absent, not a negative budget', () => {
    expect(
      resolveByteLimit({
        adapterFetchSizeLimit: -1,
        configFetchSizeLimit: 30,
      }),
    ).toBe(30)
  })

  it('does not special-case a user override of 0', () => {
    // userByteLimit is only ever set by force-load (always > 0 with
    // headroom), but document that ?? only skips null/undefined here
    expect(
      resolveByteLimit({
        userByteLimit: 0,
        configFetchSizeLimit: 30,
      }),
    ).toBe(0)
  })
})

describe('rescaleByteEstimateToVisibleSpan', () => {
  it('returns undefined when there is no estimate yet', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        estimatedBytesForMeasuredSpan: undefined,
        measuredSpanBp: 10,
        visibleBp: 5,
      }),
    ).toBeUndefined()
    expect(
      rescaleByteEstimateToVisibleSpan({
        estimatedBytesForMeasuredSpan: 0,
        measuredSpanBp: 10,
        visibleBp: 5,
      }),
    ).toBeUndefined()
  })

  it('passes the estimate through when the measured span is unknown', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        estimatedBytesForMeasuredSpan: 1000,
        measuredSpanBp: undefined,
        visibleBp: 5,
      }),
    ).toBe(1000)
  })

  it('scales proportionally: zoom-in (smaller visibleBp) shrinks the estimate', () => {
    // measured 1MB over a span of 100; zooming in to span 25 → quarter the data
    expect(
      rescaleByteEstimateToVisibleSpan({
        estimatedBytesForMeasuredSpan: 1_000_000,
        measuredSpanBp: 100,
        visibleBp: 25,
      }),
    ).toBe(250_000)
  })

  it('is a no-op at the span it was measured over', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        estimatedBytesForMeasuredSpan: 1_000_000,
        measuredSpanBp: 100,
        visibleBp: 100,
      }),
    ).toBe(1_000_000)
  })

  // The whole point of scaling: a too-large verdict measured while zoomed out
  // must self-release once the user zooms in, without any imperative re-clear.
  it('lets the too-large verdict self-release on zoom-in', () => {
    const byteLimit = 500_000
    const measured = {
      estimatedBytesForMeasuredSpan: 2_000_000,
      measuredSpanBp: 200,
    }

    const zoomedOut = evaluateRegionTooLarge({
      visibleBp: AUTO_FORCE_LOAD_BP * 2,
      estimatedBytesForVisibleSpan: rescaleByteEstimateToVisibleSpan({
        ...measured,
        visibleBp: 200,
      }),
      byteLimit,
    })
    expect(zoomedOut.tooLarge).toBe(true)

    // zoom in 5× (span 200 → 40): scaled estimate 400_000 < 500_000 limit
    const zoomedIn = evaluateRegionTooLarge({
      visibleBp: AUTO_FORCE_LOAD_BP * 2,
      estimatedBytesForVisibleSpan: rescaleByteEstimateToVisibleSpan({
        ...measured,
        visibleBp: 40,
      }),
      byteLimit,
    })
    expect(zoomedIn.tooLarge).toBe(false)
  })
})

describe('bytesTooLargeReason', () => {
  it('formats a human-readable byte size', () => {
    expect(bytesTooLargeReason(5_000_000)).toBe(
      'Requested too much data (5 Mb)',
    )
  })
})

describe('evaluateRegionTooLarge', () => {
  const big = AUTO_FORCE_LOAD_BP + 1

  it('never gates below AUTO_FORCE_LOAD_BP, even with huge bytes/density', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: AUTO_FORCE_LOAD_BP - 1,
        estimatedBytesForVisibleSpan: 1e9,
        byteLimit: 1,
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  it('gates on bytes over the limit', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        estimatedBytesForVisibleSpan: 2_000_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({
      tooLarge: true,
      reason: bytesTooLargeReason(2_000_000),
    })
  })

  it('passes when bytes are within the limit', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        estimatedBytesForVisibleSpan: 500_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  // Byte-only displays (e.g. LinearAlignmentsDisplay) never pass
  // densityTooLarge — density gating must stay fully opt-in.
  it('does not gate on density when densityTooLarge is omitted (byte-only)', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        estimatedBytesForVisibleSpan: 500_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  it('gates on density with its own reason when no byte budget applies', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: true, reason: TOO_MANY_FEATURES_REASON })
  })

  it('bytes take precedence over density for the reason text', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        estimatedBytesForVisibleSpan: 2_000_000,
        byteLimit: 1_000_000,
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: true, reason: bytesTooLargeReason(2_000_000) })
  })

  it('ignores bytes when no limit is provided (density-only path)', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        estimatedBytesForVisibleSpan: 2_000_000,
        densityTooLarge: false,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  // Self-summarizing adapters (BigWig/Hic) declare alwaysRender; it must win
  // over both gates and stay immune to a threshold/byte budget of any size.
  it('never gates when alwaysRender is set, even over byte and density limits', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        estimatedBytesForVisibleSpan: 1e9,
        byteLimit: 1,
        densityTooLarge: true,
        alwaysRender: true,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })
})
