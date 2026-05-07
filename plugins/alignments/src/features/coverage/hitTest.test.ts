import { hitTestCoverage } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'

function makeRpcData(overrides: Partial<PileupDataResult> = {}): PileupDataResult {
  return {
    mismatchPositions: new Uint32Array(),
    interbasePositions: new Uint32Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    ...overrides,
  } as PileupDataResult
}

// Block: 200px wide, covers [1000, 1010] (bpPerPx = 0.05 — zoomed in, no bin search)
function makeResolved(overrides: Partial<ResolvedBlock> = {}): ResolvedBlock {
  return {
    rpcData: makeRpcData(),
    bpRange: [1000, 1010] as [number, number],
    blockStartPx: 0,
    blockWidth: 200,
    refName: 'chr1',
    reversed: false,
    ...overrides,
  }
}

describe('hitTestCoverage guards', () => {
  it('returns undefined when showCoverage is false', () => {
    const resolved = makeResolved({
      rpcData: makeRpcData({ coverageDepths: new Float32Array([10]), coverageStartPos: 1000 }),
    })
    expect(hitTestCoverage(0, 20, resolved, false, 50)).toBeUndefined()
  })

  it('returns undefined when canvasY exceeds coverageHeight', () => {
    const resolved = makeResolved({
      rpcData: makeRpcData({ coverageDepths: new Float32Array([10]), coverageStartPos: 1000 }),
    })
    expect(hitTestCoverage(0, 60, resolved, true, 50)).toBeUndefined()
  })

  it('returns undefined when resolved is undefined', () => {
    expect(hitTestCoverage(0, 20, undefined, true, 50)).toBeUndefined()
  })

  it('returns undefined when binIndex falls outside coverageDepths', () => {
    // coverageStartPos=1000, depth covers only position 1000; mouse at 1005 → out of bounds
    const resolved = makeResolved({
      rpcData: makeRpcData({ coverageDepths: new Float32Array([10]), coverageStartPos: 1000 }),
    })
    // canvasX=100 → frac=0.5 → genomicPos = 1000 + 0.5*10 = 1005 → binIndex=5 out of bounds
    expect(hitTestCoverage(100, 20, resolved, true, 50)).toBeUndefined()
  })
})

describe('hitTestCoverage basic hit', () => {
  it('returns bin position when bpPerPx <= 1 (no bin search)', () => {
    // bpRange=[1000,1010], blockWidth=200 → bpPerPx=0.05
    // canvasX=0 → genomicPos=1000 → binIndex=0 → binStart=1000
    const resolved = makeResolved({
      rpcData: makeRpcData({ coverageDepths: new Float32Array([10, 20]), coverageStartPos: 1000 }),
    })
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1000)
  })
})

describe('hitTestCoverage zoomed-out bin search', () => {
  // Block: 10px wide covering [1000, 1100] → bpPerPx=10 (>1, triggers bin search)
  // canvasX=0 → genomicPos=1000 → binIndex=0 → binStart=1000, binEnd=1010
  function makeZoomedBlock(rpcOverrides: Partial<PileupDataResult> = {}) {
    return makeResolved({
      bpRange: [1000, 1100] as [number, number],
      blockWidth: 10,
      rpcData: makeRpcData({
        coverageDepths: new Float32Array(100).fill(10),
        coverageStartPos: 1000,
        ...rpcOverrides,
      }),
    })
  }

  it('snaps to a mismatch position when frequency exceeds 5%', () => {
    // depth=10, two mismatches at 1003 → frequency = 2/10 = 20% > 5%
    const resolved = makeZoomedBlock({
      mismatchPositions: new Uint32Array([1003, 1003]),
    })
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1003)
  })

  it('does not snap to a mismatch when frequency is below 5%', () => {
    // depth=100, one mismatch at 1003 → frequency = 1/100 = 1% < 5%
    const resolved = makeZoomedBlock({
      coverageDepths: new Float32Array(100).fill(100),
      mismatchPositions: new Uint32Array([1003]),
    })
    // Falls back to binStart=1000
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1000)
  })

  it('snaps to an interbase position when frequency exceeds 20%', () => {
    // depth=10, three interbase entries at 1005 → frequency = 3/10 = 30% > 20%
    const resolved = makeZoomedBlock({
      interbasePositions: new Uint32Array([1005, 1005, 1005]),
    })
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1005)
  })

  it('does not snap when interbase frequency is below 20%', () => {
    // depth=10, one interbase entry at 1005 → frequency = 1/10 = 10% < 20%
    const resolved = makeZoomedBlock({
      interbasePositions: new Uint32Array([1005]),
    })
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1000)
  })

  it('prefers snp snap over interbase snap', () => {
    // Both a mismatch and interbase at different positions — mismatch is checked first
    const resolved = makeZoomedBlock({
      mismatchPositions: new Uint32Array([1002, 1002]),
      interbasePositions: new Uint32Array([1005, 1005, 1005]),
    })
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1002)
  })

  it('falls back to bin start when no significant features in bin', () => {
    const resolved = makeZoomedBlock()
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1000)
  })
})

describe('hitTestCoverage reversed region', () => {
  it('mirrors genomicPos for reversed blocks', () => {
    // reversed: genomicPos = bpRange[1] - frac*(span) = 1010 - 0*(10) = 1010
    // but binIndex = 1010 - 1000 = 10, out of bounds for Float32Array(10)
    // Use canvasX at start of block: frac=0 → genomicPos=1010
    const resolved = makeResolved({
      reversed: true,
      rpcData: makeRpcData({
        coverageDepths: new Float32Array(11).fill(5),
        coverageStartPos: 1000,
      }),
    })
    // frac=0 → genomicPos = 1010 - 0*10 = 1010 → binIndex=10 → depth=5
    const result = hitTestCoverage(0, 20, resolved, true, 50)
    expect(result?.position).toBe(1010)
  })
})
