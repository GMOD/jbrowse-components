import { INTERBASE_INSERTION, INTERBASE_SOFTCLIP } from '../../shared/types.ts'
import { getTooltipBin } from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Coverage-only baseline; each test layers on the interbase/gap arrays it needs.
function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
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
  } as PileupDataResult
}

// The interbase and deletion tallies report the same count/min/max/mean
// statistic. Pin the mean in particular: it is the one field that needs a divide
// after the accumulating pass, and the two tallies used to reach it by different
// routes.
describe('getTooltipBin length stats', () => {
  test('interbase lengths tally per type, with the mean divided once', () => {
    const bin = getTooltipBin(
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
    const bin = getTooltipBin(
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
    const bin = getTooltipBin(
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

  test('skips (gapType 1) are not deletions', () => {
    const bin = getTooltipBin(
      100,
      makeRpcData({
        gapPositions: new Uint32Array([95, 105]),
        gapTypes: new Uint8Array([1]),
      }),
    )
    expect(bin?.deletions).toBeUndefined()
  })

  test('the depth-only tooltip omits interbase events', () => {
    const data = makeRpcData({
      interbasePositions: new Uint32Array([100]),
      interbaseLengths: new Uint32Array([5]),
      interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
      interbaseSequences: [''],
    })
    expect(getTooltipBin(100, data, true)?.interbase.insertion).toBeDefined()
    expect(getTooltipBin(100, data, false)?.interbase).toEqual({})
  })
})
