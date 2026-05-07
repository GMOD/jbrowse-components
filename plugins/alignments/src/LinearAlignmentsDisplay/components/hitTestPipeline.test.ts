import { performHitTest, SNP_HIT_MAX_BP_PER_PX } from './hitTestPipeline.ts'

import type { HitTestOptions } from './hitTestPipeline.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'

function makeRpcData(overrides: Partial<PileupDataResult> = {}): PileupDataResult {
  return {
    mismatchPositions: new Uint32Array(),
    interbasePositions: new Uint32Array(),
    gapPositions: new Uint32Array(),
    gapYs: new Uint16Array(),
    gapTypes: new Uint8Array(),
    modificationPositions: new Uint32Array(),
    modificationYs: new Uint16Array(),
    modificationColors: new Uint32Array(),
    readPositions: new Uint32Array(),
    readYs: new Uint16Array(),
    readIds: [],
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint16Array(),
    interbaseTypes: new Uint8Array(),
    interbaseSequences: [],
    indicatorPositions: new Uint32Array(),
    indicatorColorTypes: new Uint8Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    ...overrides,
  } as PileupDataResult
}

// Standard block: 200px wide, covers [0, 20000] → bpPerPx=100.
// canvasX=100 → genomicPos=10000.
// Coverage area: top 50px. Pileup starts at topOffset=50.
// Row height = featureHeight(10) + spacing(2) = 12px.
// canvasY=60 → adjustedY=10, row=0, yWithinRow=10 (= featureHeightSetting, still in feature)
// canvasY=61 → adjustedY=11, row=0, yWithinRow=11 (> featureHeightSetting, in spacing)
function makeResolved(rpcOverrides: Partial<PileupDataResult> = {}): ResolvedBlock {
  return {
    rpcData: makeRpcData(rpcOverrides),
    bpRange: [0, 20000] as [number, number],
    blockStartPx: 0,
    blockWidth: 200,
    refName: 'chr1',
    reversed: false,
  }
}

const ZOOMED_OUT_OPTS: HitTestOptions = {
  showCoverage: true,
  showInterbaseIndicators: true,
  coverageHeight: 50,
  topOffset: 50,
  featureHeightSetting: 10,
  featureSpacing: 2,
  rangeY: [0, 1000] as [number, number],
  isChainMode: false,
}

test('SNP_HIT_MAX_BP_PER_PX is 25', () => {
  expect(SNP_HIT_MAX_BP_PER_PX).toBe(25)
})

describe('coverage hit — fires at all zoom levels', () => {
  it('returns coverage hit when bpPerPx > threshold and cursor is in coverage area', () => {
    const resolved = makeResolved({
      coverageDepths: new Float32Array(200).fill(10),
      coverageStartPos: 9900,
    })
    // canvasX=100 → genomicPos=10000; canvasY=30 < coverageHeight=50
    const result = performHitTest(100, 30, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('coverage')
  })

  it('returns none when cursor is in coverage area but coverage is not shown', () => {
    const resolved = makeResolved({
      coverageDepths: new Float32Array(200).fill(10),
      coverageStartPos: 9900,
    })
    const result = performHitTest(100, 30, resolved, {
      ...ZOOMED_OUT_OPTS,
      showCoverage: false,
    })
    expect(result.type).toBe('none')
  })
})

describe('indicator hit — fires at all zoom levels', () => {
  it('returns indicator hit in top-5px strip when bpPerPx > threshold', () => {
    const resolved = makeResolved({
      indicatorPositions: new Uint32Array([10000]),
      indicatorColorTypes: new Uint8Array([1]),
    })
    // canvasY=3 ≤ 5 — indicator strip; genomicPos=10000 matches indicator
    const result = performHitTest(100, 3, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('indicator')
  })

  it('does not return indicator when showInterbaseIndicators is false', () => {
    const resolved = makeResolved({
      indicatorPositions: new Uint32Array([10000]),
      indicatorColorTypes: new Uint8Array([1]),
    })
    const result = performHitTest(100, 3, resolved, {
      ...ZOOMED_OUT_OPTS,
      showInterbaseIndicators: false,
    })
    expect(result.type).toBe('none')
  })
})

describe('gap hit — zoomed-out pileup', () => {
  it('returns cigar hit for a deletion wider than 1px (length >= bpPerPx)', () => {
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9500, 10500]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([0]),
    })
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('deletion')
      expect(result.hit.length).toBe(1000)
    }
  })

  it('does not return cigar hit for a sub-pixel deletion (length < bpPerPx)', () => {
    // 20bp gap at bpPerPx=100 → 0.2px wide — not visible
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9990, 10010]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([0]),
    })
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('none')
  })

  it('does not return cigar hit when yWithinRow exceeds featureHeightSetting', () => {
    // canvasY=61 → adjustedY=11, yWithinRow=11 > featureHeightSetting=10
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9500, 10500]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([0]),
    })
    const result = performHitTest(100, 61, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('none')
  })

  it('returns cigar hit for a skip wider than 1px', () => {
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9000, 11000]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([1]),
    })
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('skip')
    }
  })
})

describe('priority: coverage area beats pileup at any zoom', () => {
  it('returns coverage hit rather than gap hit when cursor is above coverageHeight', () => {
    const resolved = makeResolved({
      coverageDepths: new Float32Array(200).fill(10),
      coverageStartPos: 9900,
      gapPositions: new Uint32Array([0, 20000]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([0]),
    })
    const result = performHitTest(100, 30, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('coverage')
  })
})

describe('returns none when resolved is undefined', () => {
  it('returns none immediately', () => {
    const result = performHitTest(100, 30, undefined, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('none')
  })
})

describe('detailed hit tests still fire when bpPerPx <= threshold', () => {
  // bpRange=[0,200], blockWidth=200 → bpPerPx=1; canvasX=100 → genomicPos=100
  it('returns cigar hit for a mismatch when zoomed in', () => {
    const resolved = {
      ...makeResolved({
        mismatchPositions: new Uint32Array([100]),
        mismatchYs: new Uint16Array([0]),
        mismatchBases: new Uint8Array([65]),
      }),
      bpRange: [0, 200] as [number, number],
    }
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('mismatch')
    }
  })
})
