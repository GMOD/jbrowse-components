import {
  SUB_FLOOR_BYTE_BUDGET_FACTOR,
  TOO_MANY_FEATURES_REASON,
  bytesTooLargeReason,
  evaluateRegionTooLarge,
  nextByteEstimate,
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

  // The span tier: below AUTO_FORCE_LOAD_BP the gate keeps asking, but against a
  // larger number, because at gene scale the user navigated here deliberately.
  // Multiplies whichever tier won above, so an adapter that declares its own
  // budget keeps its relationship to the display default at both spans.
  it('raises whichever budget won, below the force-load floor', () => {
    expect(
      resolveByteLimit({
        adapterFetchSizeLimit: 20,
        configFetchSizeLimit: 30,
        belowForceLoadFloor: true,
      }),
    ).toBe(20 * SUB_FLOOR_BYTE_BUDGET_FACTOR)
    expect(
      resolveByteLimit({
        configFetchSizeLimit: 30,
        belowForceLoadFloor: true,
      }),
    ).toBe(30 * SUB_FLOOR_BYTE_BUDGET_FACTOR)
  })

  // The gate does not turn off down there, which is the whole difference from
  // the floor this replaced: index estimates are monotone in span, so a region
  // over budget below the floor was over budget above it, and an off-switch
  // meant "zoom in to see features" handed over the bytes it had just refused.
  it('still yields a finite budget below the floor', () => {
    const belowFloor = resolveByteLimit({
      configFetchSizeLimit: 5_000_000,
      belowForceLoadFloor: true,
    })
    expect(Number.isFinite(belowFloor)).toBe(true)
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: belowFloor + 1,
        byteLimit: belowFloor,
      }),
    ).toMatchObject({ tooLarge: true, axis: 'bytes' })
  })

  // Regression, measured 2026-08-14 on extra_test_data/volvox-ultradeep.bam:
  // 7,441,672 bytes at every span from 1kb to 10kb (a BAI's linear index
  // resolves 16kb bins, so the estimate is pinned below the floor). Against
  // BamAdapter's 5 Mb that bannered a gene-scale view of ordinary deep
  // sequencing with no zoom that could release it.
  it('clears the deepest BAM in this repo at gene scale, and gates it at 20kb', () => {
    const bam = { adapterFetchSizeLimit: 5_000_000, configFetchSizeLimit: 1e6 }
    const atGeneScale = 7_441_672
    const at20kb = 14_468_389
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: atGeneScale,
        byteLimit: resolveByteLimit({ ...bam, belowForceLoadFloor: true }),
      }).tooLarge,
    ).toBe(false)
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: at20kb,
        byteLimit: resolveByteLimit(bam),
      }).tooLarge,
    ).toBe(true)
  })
})

// A measurement is about a viewport: the span it was taken at, and an identity
// for the exact stretch of genome it covered. Only the span matters to
// `nextByteEstimate`, so the key is just something distinguishable.
const vp = (spanBp: number) => ({ spanBp, key: `k${spanBp}` })

// `zoomIneffective` is the banner's only honest source for "will zooming help",
// and it is evidence rather than a threshold: an index quotes whole blocks, so
// whether a given file's fetch shrinks with span is a property of that file. See
// the measurements on AUTO_FORCE_LOAD_BP.
describe('nextByteEstimate', () => {
  it('never calls zoom ineffective on the first measurement', () => {
    expect(
      nextByteEstimate(undefined, { bytes: 4_000_000, viewport: vp(100_000) }),
    ).toEqual({
      bytes: 4_000_000,
      measuredSpanBp: 100_000,
      zoomIneffective: false,
    })
  })

  // The failure this exists to name: the user zoomed 8x and the index quoted the
  // same blocks, so "zoom in to see features" is advice that cannot work.
  it('marks zoom ineffective when a big zoom-in does not move the bytes', () => {
    const first = nextByteEstimate(undefined, {
      bytes: 306_719,
      viewport: vp(100_000),
    })
    expect(
      nextByteEstimate(first, { bytes: 306_719, viewport: vp(12_500) })
        .zoomIneffective,
    ).toBe(true)
  })

  it('leaves it clear while zooming still buys something', () => {
    const first = nextByteEstimate(undefined, {
      bytes: 3_968_729,
      viewport: vp(250_000_000),
    })
    // one halving bought 47% on the whole-genome hs37d5 file
    expect(
      nextByteEstimate(first, { bytes: 2_117_393, viewport: vp(125_000_000) })
        .zoomIneffective,
    ).toBe(false)
  })

  // A pan re-measures at about the same span. Two such measurements say nothing
  // about zoom either way, so neither set the flag nor clear one already earned.
  it('treats a same-span or zoomed-out measurement as no evidence', () => {
    const stuck = {
      bytes: 306_719,
      measuredSpanBp: 12_500,
      zoomIneffective: true,
    }
    expect(
      nextByteEstimate(stuck, { bytes: 306_719, viewport: vp(12_400) })
        .zoomIneffective,
    ).toBe(true)
    expect(
      nextByteEstimate(stuck, { bytes: 400_000, viewport: vp(100_000) })
        .zoomIneffective,
    ).toBe(true)
  })

  // ...but a zoom-in that DOES shrink the fetch takes the advice back, so a
  // track that crosses out of one big block starts offering zoom again.
  it('clears the flag when a later zoom-in does move the bytes', () => {
    const stuck = {
      bytes: 306_719,
      measuredSpanBp: 12_500,
      zoomIneffective: true,
    }
    expect(
      nextByteEstimate(stuck, { bytes: 213_443, viewport: vp(6_250) })
        .zoomIneffective,
    ).toBe(false)
  })

  it('says nothing about zoom when the previous span is unusable', () => {
    const degenerate = {
      bytes: 306_719,
      measuredSpanBp: 0,
      zoomIneffective: true,
    }
    expect(
      nextByteEstimate(degenerate, { bytes: 306_719, viewport: vp(10_000) }),
    ).toEqual({
      bytes: 306_719,
      measuredSpanBp: 10_000,
      zoomIneffective: false,
    })
  })

  // dividing by it reads as "the bytes did not fall" at the moment they rose
  it('says nothing about zoom when the previous measurement was zero bytes', () => {
    const emptyContig = {
      bytes: 0,
      measuredSpanBp: 100_000,
      zoomIneffective: false,
    }
    expect(
      nextByteEstimate(emptyContig, { bytes: 500_000, viewport: vp(10_000) }),
    ).toEqual({
      bytes: 500_000,
      measuredSpanBp: 10_000,
      zoomIneffective: false,
    })
  })

  it('stores a zero measurement rather than treating it as absent', () => {
    expect(
      nextByteEstimate(undefined, { bytes: 0, viewport: vp(100_000) }),
    ).toEqual({ bytes: 0, measuredSpanBp: 100_000, zoomIneffective: false })
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
        estimatedFetchBytes: 2_000_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({
      tooLarge: true,
      reason: bytesTooLargeReason(2_000_000),
      axis: 'bytes',
    })
  })

  it('passes when bytes are within the limit', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: 500_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  // Byte-only displays (e.g. LinearAlignmentsDisplay) never pass
  // densityTooLarge — density gating must stay fully opt-in.
  it('does not gate on density when densityTooLarge is omitted (byte-only)', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: 500_000,
        byteLimit: 1_000_000,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  it('gates on density with its own reason when no byte budget applies', () => {
    expect(
      evaluateRegionTooLarge({
        densityTooLarge: true,
      }),
    ).toEqual({
      tooLarge: true,
      reason: TOO_MANY_FEATURES_REASON,
      axis: 'density',
    })
  })

  it('bytes take precedence over density for the reason text', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: 2_000_000,
        byteLimit: 1_000_000,
        densityTooLarge: true,
      }),
    ).toEqual({
      tooLarge: true,
      reason: bytesTooLargeReason(2_000_000),
      axis: 'bytes',
    })
  })

  // The axis is what `zoomCanReleaseGate` branches on, and it has to be a
  // separate field rather than a re-read of `reason`: the banner's wording is
  // free to change, the question "can zoom release this?" is not.
  it('names the axis that tripped, and none when nothing did', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: 500_000,
        byteLimit: 1_000_000,
        densityTooLarge: false,
      }).axis,
    ).toBeUndefined()
  })

  it('ignores bytes when no limit is provided (density-only path)', () => {
    expect(
      evaluateRegionTooLarge({
        estimatedFetchBytes: 2_000_000,
        densityTooLarge: false,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  // Force-load, the opt-in, and the AUTO_FORCE_LOAD_BP floor on the density
  // axis are NOT this function's business — they live in `gateActive` /
  // `densityGateActive`, pinned per display in each
  // `derivedRegionTooLarge.test.ts`.
})
