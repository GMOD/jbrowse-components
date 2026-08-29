import { hitTestCoverage } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// `mismatchBases` defaults to one allele ('A') at every mismatch position, which
// is the shape every case here but the per-allele ones wants.
function makeRpcData(overrides: Partial<PileupDataResult> = {}): PileupDataResult {
  const data = {
    mismatchPositions: new Uint32Array(),
    interbasePositions: new Uint32Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    ...overrides,
  }
  return {
    ...data,
    mismatchBases:
      overrides.mismatchBases ??
      new Uint8Array(data.mismatchPositions.length).fill(65),
  } as PileupDataResult
}

// bpRange=[1000,1010], blockWidth=200 → bpPerPx=0.05 (zoomed in, no bin search)
// canvasX=0 → frac=0 → basePos=1000
const ZOOMED_IN = { basePos: 1000, bpPerPx: 0.05 }

describe('hitTestCoverage guards', () => {
  it('returns undefined when showCoverage is false', () => {
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10]),
      coverageStartPos: 1000,
    })
    expect(
      hitTestCoverage(ZOOMED_IN.basePos, ZOOMED_IN.bpPerPx, 20, rpcData, 0),
    ).toBeUndefined()
  })

  it('returns undefined when canvasY exceeds coverageHeight', () => {
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10]),
      coverageStartPos: 1000,
    })
    expect(
      hitTestCoverage(ZOOMED_IN.basePos, ZOOMED_IN.bpPerPx, 60, rpcData, 50),
    ).toBeUndefined()
  })

  it('returns undefined when binIndex falls outside coverageDepths', () => {
    // coverageStartPos=1000, depth covers only position 1000;
    // basePos=1005 → binIndex=5, out of bounds for Float32Array(1)
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10]),
      coverageStartPos: 1000,
    })
    expect(
      hitTestCoverage(1005, ZOOMED_IN.bpPerPx, 20, rpcData, 50),
    ).toBeUndefined()
  })
})

describe('hitTestCoverage basic hit', () => {
  it('returns bin position when bpPerPx <= 1 (no bin search)', () => {
    // basePos=1000, bpPerPx=0.05 → binIndex=0 → binStart=1000
    const rpcData = makeRpcData({
      coverageDepths: new Float32Array([10, 20]),
      coverageStartPos: 1000,
    })
    const result = hitTestCoverage(
      ZOOMED_IN.basePos,
      ZOOMED_IN.bpPerPx,
      20,
      rpcData,
      50,
    )
    expect(result?.position).toBe(1000)
  })
})

describe('hitTestCoverage zoomed-out bin search', () => {
  // bpPerPx=10 (>1), basePos=1000 → binStart=1000, binEnd=1010
  const bpPerPx = 10
  const basePos = 1000

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
      hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50)?.position,
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
      hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50)?.position,
    ).toBe(1000)
  })

  it('never snaps to interbase (surfaced via the histogram bars instead)', () => {
    // depth=10, three interbase entries at 1005 → 30%, previously snapped here.
    // Coverage now ignores interbase and returns the bin start.
    const rpcData = makeZoomedRpcData({
      interbasePositions: new Uint32Array([1005, 1005, 1005]),
    })
    expect(
      hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50)?.position,
    ).toBe(1000)
  })

  it('snaps to a significant snp, ignoring interbase', () => {
    const rpcData = makeZoomedRpcData({
      mismatchPositions: new Uint32Array([1002, 1002]),
      interbasePositions: new Uint32Array([1005, 1005, 1005]),
    })
    expect(
      hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50)?.position,
    ).toBe(1002)
  })

  it('falls back to bin start when no significant features in bin', () => {
    const rpcData = makeZoomedRpcData()
    expect(
      hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50)?.position,
    ).toBe(1000)
  })

  // The snap must not name a segment the band declined to colour. Its threshold
  // predates `coverageSnpMinFrequency` and was a bare 5%, so at a floor of 20% a
  // hover reported a 10% SNP that neither backend drew.
  describe("honors the band's allele-fraction floor", () => {
    // depth=10, one mismatch at 1003 → 10%: above the 5% snap floor, below a
    // 20% band floor.
    function tenPercentSnp() {
      return makeZoomedRpcData({
        mismatchPositions: new Uint32Array([1003]),
      })
    }

    it('snaps at the default floor of 0, where the band colours it', () => {
      expect(
        hitTestCoverage(basePos, bpPerPx, 20, tenPercentSnp(), 50, false, 0)
          ?.position,
      ).toBe(1003)
    })

    it('stops snapping once the band hides it', () => {
      expect(
        hitTestCoverage(
          basePos,
          bpPerPx,
          20,
          tenPercentSnp(),
          50,
          false,
          0.2,
        )?.position,
      ).toBe(1000)
    })

    // The setting only ever RAISES the threshold. At 0 every sequencing error is
    // coloured, so a snap keyed straight off it would qualify on the first
    // mismatch in the pixel and degenerate to "the leftmost bp".
    it('a floor below the snap floor does not lower it', () => {
      const rpcData = makeZoomedRpcData({
        coverageDepths: new Float32Array(100).fill(100),
        mismatchPositions: new Uint32Array([1003]),
      })
      expect(
        hitTestCoverage(
          basePos,
          bpPerPx,
          20,
          rpcData,
          50,
          false,
          0.01,
        )?.position,
      ).toBe(1000)
    })
  })

  // The band hides one allele at a time, so the floor it hides them with is a
  // per-allele question. The snap floor above is the pooled one, because
  // dominance in a pixel is the bar's whole coloured height — and a position can
  // clear that with every segment of it hidden.
  describe("the band's floor applies per allele, not pooled", () => {
    // depth 100, 40 mismatches on one bp: 40% pooled either way, and the bases
    // decide whether any single allele reaches the 30% floor.
    function fortyMismatches(bases: Uint8Array) {
      return makeZoomedRpcData({
        coverageDepths: new Float32Array(100).fill(100),
        mismatchPositions: new Uint32Array(40).fill(1003),
        mismatchBases: bases,
      })
    }

    it('does not snap to four 10% alleles the band paints nothing for', () => {
      const alleles = [65, 67, 71, 84]
      const bases = Uint8Array.from(
        { length: 40 },
        (_, i) => alleles[Math.floor(i / 10)]!,
      )
      expect(
        hitTestCoverage(
          basePos,
          bpPerPx,
          20,
          fortyMismatches(bases),
          50,
          false,
          0.3,
        )?.position,
      ).toBe(1000)
    })

    it('snaps when one allele reaches the floor on its own', () => {
      const bases = new Uint8Array(40).fill(65)
      expect(
        hitTestCoverage(
          basePos,
          bpPerPx,
          20,
          fortyMismatches(bases),
          50,
          false,
          0.3,
        )?.position,
      ).toBe(1003)
    })
  })

  // On a reversed block bp runs LEFTWARD, so the pixel holding base 1000 covers
  // (990, 1000], not [1000, 1010). Widening rightward regardless searched the
  // neighbouring pixel's bp and snapped to a SNP the cursor was not over.
  describe('on a reversed block the pixel widens the other way', () => {
    it('reaches a SNP to the left of the cursor', () => {
      const rpcData = makeZoomedRpcData({
        mismatchPositions: new Uint32Array([995, 995]),
        coverageStartPos: 900,
        coverageDepths: new Float32Array(200).fill(10),
      })
      expect(
        hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50, true)?.position,
      ).toBe(995)
      // …and the forward reading of the same data does not, because 995 is
      // behind the cursor there.
      expect(
        hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50, false)
          ?.position,
      ).toBe(1000)
    })

    it('does not reach a SNP to the right of the cursor', () => {
      const rpcData = makeZoomedRpcData({
        mismatchPositions: new Uint32Array([1005, 1005]),
      })
      expect(
        hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50, true)?.position,
      ).toBe(1000)
      expect(
        hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50, false)
          ?.position,
      ).toBe(1005)
    })

    it('still includes the base under the cursor itself', () => {
      const rpcData = makeZoomedRpcData({
        mismatchPositions: new Uint32Array([1000, 1000]),
      })
      expect(
        hitTestCoverage(basePos, bpPerPx, 20, rpcData, 50, true)?.position,
      ).toBe(1000)
    })
  })
})
