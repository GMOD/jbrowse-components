import {
  SNP_HIT_MAX_BP_PER_PX,
  contextMenuFieldsForHit,
  performHitTest,
} from './hitTestPipeline.ts'

import type { HitTestOptions } from './hitTestPipeline.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
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
// canvasY=60 → adjustedY=10, row=0, yWithinRow=10 (= featureHeight, still in feature)
// canvasY=61 → adjustedY=11, row=0, yWithinRow=11 (> featureHeight, in spacing)
function makeResolved(
  rpcOverrides: Partial<PileupDataResult> = {},
): ResolvedBlock {
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
  coverageMaxDepth: undefined,
  topOffset: 50,
  coverageTopOffset: 0,
  featureHeight: 10,
  featureSpacing: 2,
  scrollTop: 0,
  isChainMode: false,
  filterMismatchesByFrequency: true,
  pileupVisible: true,
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

  it('does not return cigar hit when yWithinRow exceeds featureHeight', () => {
    // canvasY=61 → adjustedY=11, yWithinRow=11 > featureHeight=10
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

  // bpRange=[0,2000], blockWidth=200 → bpPerPx=10: mismatches are still
  // hit-tested (<= SNP_HIT_MAX_BP_PER_PX) but the frequency gate applies.
  function lowFreqMismatchZoomedOut() {
    return {
      ...makeResolved({
        mismatchPositions: new Uint32Array([1000]),
        mismatchYs: new Uint16Array([0]),
        mismatchBases: new Uint8Array([65]),
        mismatchFrequencies: new Uint8Array([1]), // below CIGAR_CLICK_MIN_FREQ
      }),
      bpRange: [0, 2000] as [number, number],
    }
  }

  it('low-frequency mismatch is not clickable when frequency filtering is on', () => {
    const result = performHitTest(
      100,
      60,
      lowFreqMismatchZoomedOut(),
      ZOOMED_OUT_OPTS,
    )
    expect(result.type).not.toBe('cigar')
  })

  it('low-frequency mismatch stays clickable when frequency filtering is off', () => {
    const result = performHitTest(100, 60, lowFreqMismatchZoomedOut(), {
      ...ZOOMED_OUT_OPTS,
      filterMismatchesByFrequency: false,
    })
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('mismatch')
    }
  })
})

describe('contextMenuFieldsForHit', () => {
  const resolved = makeResolved()

  it('coverage and none hits show no menu', () => {
    expect(
      contextMenuFieldsForHit({
        type: 'coverage',
        hit: { type: 'coverage', position: 1 },
        resolved,
      }).show,
    ).toBe(false)
    expect(contextMenuFieldsForHit({ type: 'none' }).show).toBe(false)
  })

  it('a feature hit carries the feature id', () => {
    expect(
      contextMenuFieldsForHit({
        type: 'feature',
        hit: { id: 'r1', index: 3 },
        resolved,
      }),
    ).toEqual({ show: true, featureId: 'r1' })
  })

  it('a cigar hit carries both the cigar hit and its read feature id', () => {
    const cigar = { type: 'mismatch', index: 0, position: 42 } as const
    expect(
      contextMenuFieldsForHit({
        type: 'cigar',
        hit: cigar,
        featureHit: { id: 'r2', index: 1 },
        resolved,
      }),
    ).toEqual({ show: true, cigarHit: cigar, featureId: 'r2' })
  })

  // regression: a modification hit used to fall through to the native browser
  // menu; it must expose the read's feature id (and the base's cigar hit).
  it('a modification hit exposes the underlying read feature id', () => {
    const cigar = {
      type: 'mismatch',
      index: 0,
      position: 7,
      base: 'A',
    } as const
    const fields = contextMenuFieldsForHit({
      type: 'modification',
      hit: { position: 7, modType: 'm', probability: 0.9, color: '#f00' },
      featureHit: { id: 'r3', index: 2 },
      cigarHit: cigar,
      resolved,
    })
    expect(fields).toEqual({ show: true, cigarHit: cigar, featureId: 'r3' })
  })

  it('an indicator hit carries the indicator hit but no feature', () => {
    const ind = {
      type: 'indicator' as const,
      position: 100,
      indicatorType: 'insertion' as const,
    }
    const fields = contextMenuFieldsForHit({
      type: 'indicator',
      hit: ind,
      resolved,
    })
    expect(fields.show).toBe(true)
    expect(fields.indicatorHit).toBe(ind)
    expect(fields.featureId).toBeUndefined()
  })
})
