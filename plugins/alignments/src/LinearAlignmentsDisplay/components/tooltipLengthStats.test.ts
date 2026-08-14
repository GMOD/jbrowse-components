import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import { getInterbaseBin, getCoverageBin } from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Coverage-only baseline; each test layers on the interbase/gap arrays it needs.
//
// The three interbase block counts are DERIVED from `interbaseTypes` rather than
// left to each test, because they are half of the interbase layout contract:
// `interbasePositions` is grouped (insertions, softclips, hardclips) and sorted
// within each block, and the tooltip reader binary-searches those blocks. A
// fixture that sets positions and leaves the counts at 0 reads as "no interbase
// events here" instead of failing, which is exactly how this file broke when the
// reader stopped scanning the whole array. An explicit override still wins, for a
// test that wants to state an inconsistent layout on purpose.
function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  const merged = {
    coverageStartPos: 100,
    coverageDepths: new Float32Array([10]),
    coverageFwdDepths: new Float32Array(),
    coverageRevDepths: new Float32Array(),
    mismatchPositions: new Uint32Array(),
    mismatchBases: new Uint8Array(),
    mismatchStrands: new Int8Array(),
    interbasePositions: new Uint32Array(),
    interbaseLengths: new Uint32Array(),
    interbaseTypes: new Uint8Array(),
    interbaseSequences: [],
    gapPositions: new Uint32Array(),
    gapTypes: new Uint8Array(),
    ...overrides,
  }
  const tally = (type: number) =>
    [...merged.interbaseTypes].filter(t => t === type).length
  return {
    numInsertions: tally(INTERBASE_INSERTION),
    numSoftclips: tally(INTERBASE_SOFTCLIP),
    numHardclips: tally(INTERBASE_HARDCLIP),
    ...merged,
  } as PileupDataResult
}

// The interbase and deletion tallies report the same count/min/max/mean
// statistic. Pin the mean in particular: it is the one field that needs a divide
// after the accumulating pass, and the two tallies used to reach it by different
// routes.
describe('tooltip bin length stats', () => {
  test('interbase lengths tally per type, with the mean divided once', () => {
    const bin = getInterbaseBin(
      100,
      makeRpcData({
        // three insertions (2, 4, 6 -> mean 4) and one softclip, all at bp 100
        interbasePositions: new Uint32Array([100, 100, 100, 100]),
        interbaseLengths: new Uint32Array([2, 4, 6, 9]),
        interbaseTypes: new Uint8Array([
          INTERBASE_INSERTION,
          INTERBASE_INSERTION,
          INTERBASE_INSERTION,
          INTERBASE_SOFTCLIP,
        ]),
        interbaseSequences: ['AT', 'ATAT', 'AT', ''],
      }),
    )
    expect(bin?.interbase.insertion).toEqual({
      count: 3,
      minLen: 2,
      maxLen: 6,
      avgLen: 4,
      topSeq: 'AT',
      topSeqCount: 2,
    })
    // clips carry no sequence, so there is no most-frequent one to report
    expect(bin?.interbase.softclip).toEqual({
      count: 1,
      minLen: 9,
      maxLen: 9,
      avgLen: 9,
    })
  })

  test('only interbases at exactly the hovered position count', () => {
    const bin = getInterbaseBin(
      100,
      makeRpcData({
        interbasePositions: new Uint32Array([99, 100, 101]),
        interbaseLengths: new Uint32Array([5, 7, 5]),
        interbaseTypes: new Uint8Array([
          INTERBASE_INSERTION,
          INTERBASE_INSERTION,
          INTERBASE_INSERTION,
        ]),
        interbaseSequences: ['', '', ''],
      }),
    )
    expect(bin?.interbase.insertion).toEqual({
      count: 1,
      minLen: 7,
      maxLen: 7,
      avgLen: 7,
    })
  })

  test('deletions spanning the position tally the same way', () => {
    // [90,100) ends before 100 so it does not span it; [95,105) and [98,110) do,
    // lengths 10 and 12 -> mean 11
    const bin = getCoverageBin(
      100,
      makeRpcData({
        gapPositions: new Uint32Array([90, 100, 95, 105, 98, 110]),
        gapTypes: new Uint8Array([0, 0, 0]),
      }),
    )
    expect(bin?.deletions).toEqual({
      count: 2,
      minLen: 10,
      maxLen: 12,
      avgLen: 11,
    })
  })

  // The tally walks LEFT from the last deletion starting at or before the
  // cursor and stops when the running maximum of the ends behind it no longer
  // reaches the cursor. A long deletion starting well to the left of several
  // short ones is what that bound has to survive: stopping at the first
  // non-spanning deletion instead would miss it.
  test('a long deletion behind several short ones is still found', () => {
    const bin = getCoverageBin(
      1000,
      makeRpcData({
        gapPositions: new Uint32Array([
          100, 5000, 300, 310, 400, 410, 900, 1100, 995, 996,
        ]),
        gapTypes: new Uint8Array([0, 0, 0, 0, 0]),
      }),
    )
    expect(bin?.deletions).toEqual({
      count: 2,
      minLen: 200,
      maxLen: 4900,
      avgLen: 2550,
    })
  })

  test('skips (gapType 1) are not deletions', () => {
    const bin = getCoverageBin(
      100,
      makeRpcData({
        gapPositions: new Uint32Array([95, 105]),
        gapTypes: new Uint8Array([1]),
      }),
    )
    expect(bin?.deletions).toBeUndefined()
  })

  // Interbase events belong to the histogram bars, depth/SNPs to the coverage
  // area, and the two entry points are what keep them from being double-reported.
  test('interbase events reach only the interbase bin', () => {
    const data = makeRpcData({
      coverageDepths: new Float32Array([0]),
      interbasePositions: new Uint32Array([100]),
      interbaseLengths: new Uint32Array([5]),
      interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
      interbaseSequences: [''],
    })
    expect(getInterbaseBin(100, data)?.interbase.insertion).toBeDefined()
    // nothing but the interbase event here, so the depth tooltip has no bin
    expect(getCoverageBin(100, data)).toBeUndefined()
  })

  test('a position with no interbase events has no interbase bin', () => {
    expect(getInterbaseBin(100, makeRpcData())).toBeUndefined()
  })
})
