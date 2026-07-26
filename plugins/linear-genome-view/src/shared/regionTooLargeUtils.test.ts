import {
  TOO_MANY_FEATURES_REASON,
  bytesTooLargeReason,
  evaluateRegionTooLarge,
  rescaleByteEstimateToVisibleSpan,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

describe('resolveByteLimit', () => {
  it('prefers the adapter limit over the display config', () => {
    expect(
      resolveByteLimit({
        adapterFetchSizeLimit: 20,
        configFetchSizeLimit: 30,
      }),
    ).toBe(20)
  })

  it('falls back to the config default when there is no adapter limit', () => {
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
})

describe('rescaleByteEstimateToVisibleSpan', () => {
  it('returns undefined with no measurement, or an unmeasurable one', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: undefined,
        visibleBp: 5,
      }),
    ).toBeUndefined()
    // an adapter with no index estimate: "unmeasurable", not zero bytes
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: undefined, measuredSpanBp: 10 },
        visibleBp: 5,
      }),
    ).toBeUndefined()
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: 0, measuredSpanBp: 10 },
        visibleBp: 5,
      }),
    ).toBeUndefined()
  })

  // `setByteEstimate` writes the estimate and its span as one value, so an
  // estimate with no span is unrepresentable; a zero span is the only live case
  // and must not divide.
  it('yields undefined when the measured span is zero', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: 1000, measuredSpanBp: 0 },
        visibleBp: 5,
      }),
    ).toBeUndefined()
  })

  it('scales proportionally: zoom-in (smaller visibleBp) shrinks the estimate', () => {
    // measured 1MB over a span of 100; zooming in to span 25 → quarter the data
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: 1_000_000, measuredSpanBp: 100 },
        visibleBp: 25,
      }),
    ).toBe(250_000)
  })

  it('is a no-op at the span it was measured over', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: 1_000_000, measuredSpanBp: 100 },
        visibleBp: 100,
      }),
    ).toBe(1_000_000)
  })

  // The whole point of scaling: a too-large verdict measured while zoomed out
  // must self-release once the user zooms in, without any imperative re-clear.
  it('lets the too-large verdict self-release on zoom-in', () => {
    const byteLimit = 500_000
    const byteEstimate = { bytes: 2_000_000, measuredSpanBp: 200 }

    const zoomedOut = evaluateRegionTooLarge({
      estimatedBytesForVisibleSpan: rescaleByteEstimateToVisibleSpan({
        byteEstimate,
        visibleBp: 200,
      }),
      byteLimit,
    })
    expect(zoomedOut.tooLarge).toBe(true)

    // zoom in 5× (span 200 → 40): scaled estimate 400_000 < 500_000 limit
    const zoomedIn = evaluateRegionTooLarge({
      estimatedBytesForVisibleSpan: rescaleByteEstimateToVisibleSpan({
        byteEstimate,
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
  it('gates on bytes over the limit', () => {
    expect(
      evaluateRegionTooLarge({
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
        estimatedBytesForVisibleSpan: 500_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  it('gates on density with its own reason when no byte budget applies', () => {
    expect(
      evaluateRegionTooLarge({
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: true, reason: TOO_MANY_FEATURES_REASON })
  })

  it('bytes take precedence over density for the reason text', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedBytesForVisibleSpan: 2_000_000,
        byteLimit: 1_000_000,
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: true, reason: bytesTooLargeReason(2_000_000) })
  })

  it('ignores bytes when no limit is provided (density-only path)', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedBytesForVisibleSpan: 2_000_000,
        densityTooLarge: false,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  // The AUTO_FORCE_LOAD_BP floor, force-load and `alwaysRender` adapters are
  // NOT this function's business — they live in `gateActive`, pinned per display
  // in each `derivedRegionTooLarge.test.ts`.
})
