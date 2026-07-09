import {
  FORCE_LOAD_HEADROOM,
  TOO_MANY_FEATURES_REASON,
  bytesTooLargeReason,
  evaluateRegionTooLarge,
  raiseLimitPast,
  resolveByteLimit,
} from './featureDensityUtils.ts'
import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/index.ts'

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

describe('resolveByteLimit', () => {
  it('prefers the user force-load override over everything', () => {
    expect(
      resolveByteLimit({
        userByteSizeLimit: 10,
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
    // userByteSizeLimit is only ever set by force-load (always > 0 with
    // headroom), but document that ?? only skips null/undefined here
    expect(
      resolveByteLimit({
        userByteSizeLimit: 0,
        configFetchSizeLimit: 30,
      }),
    ).toBe(0)
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
        bytes: 1e9,
        byteLimit: 1,
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })

  it('gates on bytes over the limit', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        bytes: 2_000_000,
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
        bytes: 500_000,
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
        bytes: 500_000,
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
        bytes: 2_000_000,
        byteLimit: 1_000_000,
        densityTooLarge: true,
      }),
    ).toEqual({ tooLarge: true, reason: bytesTooLargeReason(2_000_000) })
  })

  it('ignores bytes when no limit is provided (density-only path)', () => {
    expect(
      evaluateRegionTooLarge({
        visibleBp: big,
        bytes: 2_000_000,
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
        bytes: 1e9,
        byteLimit: 1,
        densityTooLarge: true,
        alwaysRender: true,
      }),
    ).toEqual({ tooLarge: false, reason: '' })
  })
})
