import { hitTestCoverage } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

function makeRpcData(overrides: Partial<PileupDataResult> = {}): PileupDataResult {
  return {
    mismatchPositions: new Uint32Array(),
    interbasePositions: new Uint32Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    ...overrides,
  } as PileupDataResult
}

// bpRange=[1000,1010], blockWidth=200 → bpPerPx=0.05 (zoomed in, no bin search)
// canvasX=0 → frac=0 → genomicPos=1000
const ZOOMED_IN = { genomicPos: 1000, bpPerPx: 0.05 }

describe('hitTestCoverage guards', () => {
  it('returns undefined when showCoverage is false', () => {
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10]),
      coverageStartPos: 1000,
    })
    expect(
      hitTestCoverage(ZOOMED_IN.genomicPos, ZOOMED_IN.bpPerPx, 20, rpcData, false, 50),
    ).toBeUndefined()
  })

  it('returns undefined when canvasY exceeds coverageHeight', () => {
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10]),
      coverageStartPos: 1000,
    })
    expect(
      hitTestCoverage(ZOOMED_IN.genomicPos, ZOOMED_IN.bpPerPx, 60, rpcData, true, 50),
    ).toBeUndefined()
  })

  it('returns undefined when binIndex falls outside coverageDepths', () => {
    // coverageStartPos=1000, depth covers only position 1000;
    // genomicPos=1005 → binIndex=5, out of bounds for Float32Array(1)
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10]),
      coverageStartPos: 1000,
    })
    expect(
      hitTestCoverage(1005, ZOOMED_IN.bpPerPx, 20, rpcData, true, 50),
    ).toBeUndefined()
  })
})

describe('hitTestCoverage basic hit', () => {
  it('returns bin position when bpPerPx <= 1 (no bin search)', () => {
    // genomicPos=1000, bpPerPx=0.05 → binIndex=0 → binStart=1000
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10, 20]),
      coverageStartPos: 1000,
    })
    const result = hitTestCoverage(
      ZOOMED_IN.genomicPos,
      ZOOMED_IN.bpPerPx,
      20,
      rpcData,
      true,
      50,
    )
    expect(result?.position).toBe(1000)
  })
})

describe('hitTestCoverage zoomed-out bin search', () => {
  // bpPerPx=10 (>1), genomicPos=1000 → binStart=1000, binEnd=1010
  const bpPerPx = 10
  const genomicPos = 1000

  function makeZoomedRpcData(overrides: Partial<PileupDataResult> = {}) {
    return makeRpcData({
      coverageDepths: new Float32Array(100).fill(10),
      coverageStartPos: 1000,
      ...overrides,
    })
  }

  it('snaps to a mismatch position when frequency exceeds 5%', () => {
    // depth=10, two mismatches at 1003 → frequency = 2/10 = 20% > 5%
    const rpcData = makeZoomedRpcData({
      mismatchPositions: new Uint32Array([1003, 1003]),
    })
    expect(
      hitTestCoverage(genomicPos, bpPerPx, 20, rpcData, true, 50)?.position,
    ).toBe(1003)
  })

  it('does not snap to a mismatch when frequency is below 5%', () => {
    // depth=100, one mismatch at 1003 → frequency = 1/100 = 1% < 5%
    const rpcData = makeZoomedRpcData({
      coverageDepths: new Float32Array(100).fill(100),
      mismatchPositions: new Uint32Array([1003]),
    })
    // Falls back to binStart=1000
    expect(
      hitTestCoverage(genomicPos, bpPerPx, 20, rpcData, true, 50)?.position,
    ).toBe(1000)
  })

  it('snaps to an interbase position when frequency exceeds 20%', () => {
    // depth=10, three interbase entries at 1005 → frequency = 3/10 = 30% > 20%
    const rpcData = makeZoomedRpcData({
      interbasePositions: new Uint32Array([1005, 1005, 1005]),
    })
    expect(
      hitTestCoverage(genomicPos, bpPerPx, 20, rpcData, true, 50)?.position,
    ).toBe(1005)
  })

  it('does not snap when interbase frequency is below 20%', () => {
    // depth=10, one interbase entry at 1005 → frequency = 1/10 = 10% < 20%
    const rpcData = makeZoomedRpcData({
      interbasePositions: new Uint32Array([1005]),
    })
    expect(
      hitTestCoverage(genomicPos, bpPerPx, 20, rpcData, true, 50)?.position,
    ).toBe(1000)
  })

  it('prefers snp snap over interbase snap', () => {
    const rpcData = makeZoomedRpcData({
      mismatchPositions: new Uint32Array([1002, 1002]),
      interbasePositions: new Uint32Array([1005, 1005, 1005]),
    })
    expect(
      hitTestCoverage(genomicPos, bpPerPx, 20, rpcData, true, 50)?.position,
    ).toBe(1002)
  })

  it('falls back to bin start when no significant features in bin', () => {
    const rpcData = makeZoomedRpcData()
    expect(
      hitTestCoverage(genomicPos, bpPerPx, 20, rpcData, true, 50)?.position,
    ).toBe(1000)
  })
})
