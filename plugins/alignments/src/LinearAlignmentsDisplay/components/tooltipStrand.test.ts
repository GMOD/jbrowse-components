import { getTooltipBin } from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Minimal coverage-only payload: depth 5 at the queried bin, split 3 fwd / 2
// rev, no mismatches/interbase/gaps/mods.
function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    coverageStartPos: 100,
    coverageDepths: new Float32Array([5]),
    coverageFwdDepths: new Float32Array([3]),
    coverageRevDepths: new Float32Array([2]),
    mismatchPositions: new Uint32Array(),
    mismatchBases: new Uint8Array(),
    mismatchStrands: new Int8Array(),
    interbasePositions: new Uint32Array(),
    interbaseLengths: new Uint16Array(),
    interbaseTypes: new Uint8Array(),
    interbaseSequences: [],
    gapPositions: new Uint32Array(),
    gapTypes: new Uint8Array(),
    ...overrides,
  } as PileupDataResult
}

describe('getTooltipBin per-strand depth', () => {
  it('carries fwd/rev depth split for the hovered bin', () => {
    const bin = getTooltipBin(100, makeRpcData())
    expect(bin?.depth).toBe(5)
    expect(bin?.fwdDepth).toBe(3)
    expect(bin?.revDepth).toBe(2)
  })

  it('leaves fwd/rev undefined when no per-strand depths are present', () => {
    const bin = getTooltipBin(
      100,
      makeRpcData({
        coverageFwdDepths: new Float32Array(),
        coverageRevDepths: new Float32Array(),
      }),
    )
    expect(bin?.depth).toBe(5)
    expect(bin?.fwdDepth).toBeUndefined()
    expect(bin?.revDepth).toBeUndefined()
  })
})
