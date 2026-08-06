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

  // Spans here are deliberately realistic (above AUTO_FORCE_LOAD_BP), because
  // the proportional model only holds up there — see the clamp cases below.
  it('scales proportionally: zoom-in (smaller visibleBp) shrinks the estimate', () => {
    // measured 1MB over 400kb; zooming in to 100kb → quarter the data
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: 1_000_000, measuredSpanBp: 400_000 },
        visibleBp: 100_000,
      }),
    ).toBe(250_000)
  })

  it('is a no-op at the span it was measured over', () => {
    expect(
      rescaleByteEstimateToVisibleSpan({
        byteEstimate: { bytes: 1_000_000, measuredSpanBp: 100_000 },
        visibleBp: 100_000,
      }),
    ).toBe(1_000_000)
  })

  // The whole point of scaling: a too-large verdict measured while zoomed out
  // must self-release once the user zooms in, without any imperative re-clear.
  it('lets the too-large verdict self-release on zoom-in', () => {
    const byteLimit = 500_000
    const byteEstimate = { bytes: 2_000_000, measuredSpanBp: 200_000 }

    const zoomedOut = evaluateRegionTooLarge({
      estimatedBytesForVisibleSpan: rescaleByteEstimateToVisibleSpan({
        byteEstimate,
        visibleBp: 200_000,
      }),
      byteLimit,
    })
    expect(zoomedOut.tooLarge).toBe(true)

    // zoom in 5× (200kb → 40kb, still above the floor): 400_000 < the limit
    const zoomedIn = evaluateRegionTooLarge({
      estimatedBytesForVisibleSpan: rescaleByteEstimateToVisibleSpan({
        byteEstimate,
        visibleBp: 40_000,
      }),
      byteLimit,
    })
    expect(zoomedIn.tooLarge).toBe(false)
  })

  // Below AUTO_FORCE_LOAD_BP an index reports whole blocks, so the same query
  // costs the same bytes at every span inside one block and the proportional
  // model is fiction. Both spans are floored there, which only a display that
  // opted out of the floor can ever reach — everything else has `gateActive`
  // false below it.
  describe('the estimate goes flat below AUTO_FORCE_LOAD_BP', () => {
    const byteEstimate = { bytes: 4_000_000, measuredSpanBp: 200_000 }

    it('stops shrinking once the visible span drops under the floor', () => {
      // 40kb is above the floor and still scales: a fifth of the measurement
      expect(
        rescaleByteEstimateToVisibleSpan({ byteEstimate, visibleBp: 40_000 }),
      ).toBe(800_000)
      // 20kb is the floor exactly
      expect(
        rescaleByteEstimateToVisibleSpan({ byteEstimate, visibleBp: 20_000 }),
      ).toBe(400_000)
      // and below it every zoom quotes that same number
      for (const visibleBp of [10_000, 1_000, 200]) {
        expect(
          rescaleByteEstimateToVisibleSpan({ byteEstimate, visibleBp }),
        ).toBe(400_000)
      }
    })

    // The denominator is floored too. Without that, an estimate captured below
    // the floor would be scaled UP by the ratio of the floor to the span it was
    // measured at — a 4× inflation for a measurement taken at 5kb.
    it('does not inflate an estimate that was measured below the floor', () => {
      const measuredDeep = { bytes: 300_000, measuredSpanBp: 5_000 }
      expect(
        rescaleByteEstimateToVisibleSpan({
          byteEstimate: measuredDeep,
          visibleBp: 2_000,
        }),
      ).toBe(300_000)
      expect(
        rescaleByteEstimateToVisibleSpan({
          byteEstimate: measuredDeep,
          visibleBp: 20_000,
        }),
      ).toBe(300_000)
    })

    // The zero-span guard runs on the raw value, before any flooring, so an
    // unrepresentable estimate stays undefined rather than becoming divisible.
    it('still refuses a zero measured span', () => {
      expect(
        rescaleByteEstimateToVisibleSpan({
          byteEstimate: { bytes: 1000, measuredSpanBp: 0 },
          visibleBp: 100_000,
        }),
      ).toBeUndefined()
    })
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
