import { hitTestInterbase } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// coverageHeight=90, YSCALEBAR_LABEL_OFFSET=5 → effectiveH=80 → effectiveH/2=40.
// interbaseMaxCount/domainMax = 20/20 = 1 → interbaseHeight=40.
// A full-height (yOffset=0,height=1) bar at 1005 spans
// [INDICATOR_TRIANGLE_H(4.5), 4.5 + 1*40 = 44.5].
const COV_HEIGHT = 90
const DOMAIN_MAX = 20

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    indicatorPositions: new Uint32Array(),
    indicatorColorTypes: new Uint8Array(),
    interbaseCovPositions: new Uint32Array(),
    interbaseCovYOffsets: new Float32Array(),
    interbaseCovHeights: new Float32Array(),
    interbaseCovColorTypes: new Uint8Array(),
    interbaseMaxCount: 0,
    ...overrides,
  } as PileupDataResult
}

const oneBarAt1005 = {
  interbaseCovPositions: new Uint32Array([1005]),
  interbaseCovYOffsets: new Float32Array([0]),
  interbaseCovHeights: new Float32Array([1]),
  interbaseCovColorTypes: new Uint8Array([1]),
  interbaseMaxCount: 20,
}

describe('hitTestInterbase histogram bars', () => {
  it('hits a bar within its drawn rectangle', () => {
    const rpcData = makeRpcData(oneBarAt1005)
    const hit = hitTestInterbase(
      1005,
      0.5,
      30,
      rpcData,
      true,
      true,
      COV_HEIGHT,
      DOMAIN_MAX,
    )
    expect(hit).toEqual({
      type: 'indicator',
      position: 1005,
      indicatorType: 'insertion',
    })
  })

  it('misses below the bar bottom (that area stays a coverage hit)', () => {
    const rpcData = makeRpcData(oneBarAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        60,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toBeUndefined()
  })

  it('misses when x is beyond the horizontal tolerance', () => {
    const rpcData = makeRpcData(oneBarAt1005)
    // bpPerPx=0.5, tolerance = 0.5*3 = 1.5bp; 1005 is 3bp away from 1008.
    expect(
      hitTestInterbase(
        1008,
        0.5,
        30,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toBeUndefined()
  })

  it('ignores bars when showInterbaseIndicators is off', () => {
    const rpcData = makeRpcData(oneBarAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        30,
        rpcData,
        true,
        false,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toBeUndefined()
  })

  it('skips bars when the coverage domain has not resolved yet', () => {
    const rpcData = makeRpcData(oneBarAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        30,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        undefined,
      ),
    ).toBeUndefined()
  })

  it('returns undefined when coverage is hidden', () => {
    const rpcData = makeRpcData(oneBarAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        30,
        rpcData,
        false,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toBeUndefined()
  })

  it('reports the dominant (tallest) stacked type', () => {
    // insertion height 0.2 then softclip height 0.8 → softclip dominates.
    const rpcData = makeRpcData({
      interbaseCovPositions: new Uint32Array([1005, 1005]),
      interbaseCovYOffsets: new Float32Array([0, 0.2]),
      interbaseCovHeights: new Float32Array([0.2, 0.8]),
      interbaseCovColorTypes: new Uint8Array([1, 2]),
      interbaseMaxCount: 20,
    })
    expect(
      hitTestInterbase(
        1005,
        0.5,
        30,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      )?.indicatorType,
    ).toBe('softclip')
  })
})

describe('hitTestInterbase indicator triangles', () => {
  it('hits a triangle in the top strip when indicators are shown', () => {
    const rpcData = makeRpcData({
      indicatorPositions: new Uint32Array([1005]),
      indicatorColorTypes: new Uint8Array([3]),
    })
    expect(
      hitTestInterbase(
        1005,
        0.5,
        3,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toEqual({
      type: 'indicator',
      position: 1005,
      indicatorType: 'hardclip',
    })
  })

  it('ignores triangles when showInterbaseIndicators is off', () => {
    const rpcData = makeRpcData({
      indicatorPositions: new Uint32Array([1005]),
      indicatorColorTypes: new Uint8Array([3]),
    })
    expect(
      hitTestInterbase(
        1005,
        0.5,
        3,
        rpcData,
        true,
        false,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toBeUndefined()
  })
})
