import {
  packedIndicators,
  packedInterbaseSegments,
} from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { hitTestInterbase } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// coverageHeight=90, YSCALEBAR_LABEL_OFFSET=5 → effectiveH=80 → effectiveH/2=40.
// interbaseMaxCount/domainMax = 20/20 = 1 → interbaseHeight=40.
// Edges snap to whole px through interbaseEdgePx (floor(4.5 + y*40 + 0.5)), so a
// full-height (yOffset=0,height=1) bar at 1005 spans px [5, 45].
const COV_HEIGHT = 90
const DOMAIN_MAX = 20

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    indicatorPackedBuffer: packedIndicators([]),
    interbasePackedBuffer: packedInterbaseSegments([]),
    interbaseMaxCount: 0,
    ...overrides,
  } as PileupDataResult
}

const oneBarAt1005 = {
  interbasePackedBuffer: packedInterbaseSegments([
    { position: 1005, yOffset: 0, height: 1, colorType: 1 },
  ]),
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

  // A stacked bar: insertion occupies [0, 0.2] of the stack and softclip
  // [0.2, 1.0], i.e. px [5, 13] and [13, 45]. Which type the hover means is which
  // SEGMENT is under the cursor, not which segment is tallest — clicking opens a
  // widget titled by this type and showing only its counts.
  const stackedAt1005 = {
    interbasePackedBuffer: packedInterbaseSegments([
      { position: 1005, yOffset: 0, height: 0.2, colorType: 1 },
      { position: 1005, yOffset: 0.2, height: 0.8, colorType: 2 },
    ]),
    interbaseMaxCount: 20,
  }

  it.each([
    ['the short top segment', 8, 'insertion'],
    ['the tall bottom segment', 30, 'softclip'],
  ])('reports the type under the cursor: %s', (_name, canvasY, expected) => {
    const rpcData = makeRpcData(stackedAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        canvasY,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      )?.indicatorType,
    ).toBe(expected)
  })

  // The slack below the drawn stack (BAR_HIT_PAD_PX) belongs to the segment
  // whose bottom edge the cursor is just under.
  it('falls back to the bottom-most segment in the pad below the bar', () => {
    const rpcData = makeRpcData(stackedAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        46,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      )?.indicatorType,
    ).toBe('softclip')
  })
})

// A bar taller than the band it is drawn in. `interbaseMaxCount` is the FETCHED
// block's peak event count and `domainMax` is the VISIBLE, bounded domain, so a
// 300x breakpoint under a maxScoreBound of 20 scales to 40 * 300/20 = 600px of
// bar hanging off a 90px band. Both backends scissor that to the band; the hit
// test has to stop there too, or a +-3bp column runs the full height of the
// pileup answering interbase for every read hover, click and right-click under
// it — `performHitTest` asks this first and returns on a hit.
describe('hitTestInterbase overflowing bars', () => {
  const overflowingBarAt1005 = {
    interbasePackedBuffer: packedInterbaseSegments([
      { position: 1005, yOffset: 0, height: 1, colorType: 2 },
    ]),
    interbaseMaxCount: 300,
  }

  it('still hits the overflowing bar inside the coverage band', () => {
    const rpcData = makeRpcData(overflowingBarAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        50,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toEqual({
      type: 'indicator',
      position: 1005,
      indicatorType: 'softclip',
    })
  })

  it.each([
    ['just past the band bottom', 200],
    ['deep in the pileup', 400],
  ])('misses %s, where nothing is drawn', (_name, canvasY) => {
    const rpcData = makeRpcData(overflowingBarAt1005)
    expect(
      hitTestInterbase(
        1005,
        0.5,
        canvasY,
        rpcData,
        true,
        true,
        COV_HEIGHT,
        DOMAIN_MAX,
      ),
    ).toBeUndefined()
  })
})

describe('hitTestInterbase indicator triangles', () => {
  it('hits a triangle in the top strip when indicators are shown', () => {
    const rpcData = makeRpcData({
      indicatorPackedBuffer: packedIndicators([
        { position: 1005, colorType: 3 },
      ]),
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
      indicatorPackedBuffer: packedIndicators([
        { position: 1005, colorType: 3 },
      ]),
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
