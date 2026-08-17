import Flatbush from '@jbrowse/core/util/flatbush'

import { packedIndicators } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import {
  SNP_HIT_MAX_BP_PER_PX,
  contextMenuTargetForHit,
  performHitTest,
} from './hitTestPipeline.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { HitTestOptions } from './hitTestPipeline.ts'

function countType(types: Uint8Array, code: number) {
  let n = 0
  for (const t of types) {
    if (t === code) {
      n++
    }
  }
  return n
}

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  const data = {
    mismatchPositions: new Uint32Array(),
    mismatchFrequencies: new Uint8Array(),
    mismatchQuals: new Uint8Array(),
    interbaseFrequencies: new Uint8Array(),
    interbasePositions: new Uint32Array(),
    gapPositions: new Uint32Array(),
    gapYs: new Uint16Array(),
    gapTypes: new Uint8Array(),
    modificationPositions: new Uint32Array(),
    modificationYs: new Uint16Array(),
    modificationColors: new Uint32Array(),
    readPositions: new Uint32Array(),
    readYs: new Uint16Array(),
    readKeys: [],
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint32Array(),
    interbaseTypes: new Uint8Array(),
    interbaseSequences: [],
    softclipBasePositions: new Uint32Array(),
    softclipBaseYs: new Uint16Array(),
    softclipBaseReadIndices: new Uint32Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    ...overrides,
  } as PileupDataResult
  // The worker publishes the three counts that partition the merged interbase
  // array into (insertions, softclips, hardclips), and the insertion/clip hit
  // tests slice by them rather than re-checking a type byte per entry. Derive
  // them here so a test only has to supply `interbaseTypes` — in that canonical
  // order, which is the layout `buildInterbaseArrays` guarantees.
  const types = data.interbaseTypes
  return {
    ...data,
    numInsertions: countType(types, INTERBASE_INSERTION),
    numSoftclips: countType(types, INTERBASE_SOFTCLIP),
    numHardclips: countType(types, INTERBASE_HARDCLIP),
  }
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
  showMismatches: true,
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
      indicatorPackedBuffer: packedIndicators([
        { position: 10000, colorType: 1 },
      ]),
    })
    // canvasY=3 ≤ 5 — indicator strip; genomicPos=10000 matches indicator
    const result = performHitTest(100, 3, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('indicator')
  })

  it('does not return indicator when showInterbaseIndicators is false', () => {
    const resolved = makeResolved({
      indicatorPackedBuffer: packedIndicators([
        { position: 10000, colorType: 1 },
      ]),
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
      gapTypes: new Uint8Array([GAP_DELETION]),
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
      gapTypes: new Uint8Array([GAP_DELETION]),
    })
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('none')
  })

  it('does not return cigar hit when yWithinRow exceeds featureHeight', () => {
    // canvasY=61 → adjustedY=11, yWithinRow=11 > featureHeight=10
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9500, 10500]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([GAP_DELETION]),
    })
    const result = performHitTest(100, 61, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('none')
  })

  // The zoomed-out branch used to omit featureHit, so a right-click on a
  // deletion lost the read's own menu items and a hover dropped the chain
  // highlight purely because of zoom level. It must carry the read like the
  // zoomed-in branch does.
  it('attaches the underlying read to a zoomed-out deletion hit', () => {
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9500, 10500]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([GAP_DELETION]),
      readPositions: new Uint32Array([9000, 11000]),
      readYs: new Uint16Array([0]),
      readKeys: ['read1'],
    })
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.featureHit).toEqual({ id: 'read1', index: 0 })
      expect(contextMenuTargetForHit(result, 1)?.featureId).toBe('read1')
    }
  })

  it('returns cigar hit for a skip wider than 1px', () => {
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9000, 11000]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([GAP_SKIP]),
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
      gapTypes: new Uint8Array([GAP_DELETION]),
    })
    const result = performHitTest(100, 30, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('coverage')
  })
})

// "no block under the cursor" is no longer a case here — the caller resolves the
// block and answers `none` itself, so performHitTest takes a definite one.

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
  // hit-tested (<= SNP_HIT_MAX_BP_PER_PX) but the frequency gate applies. A
  // frequency of 0 = zeroed by the depth-dependent draw threshold (drawn only at
  // the faint noise floor), so it's not clickable while filtering is on.
  function lowFreqMismatchZoomedOut() {
    return {
      ...makeResolved({
        mismatchPositions: new Uint32Array([1000]),
        mismatchYs: new Uint16Array([0]),
        mismatchBases: new Uint8Array([65]),
        mismatchFrequencies: new Uint8Array([0]), // filtered out by draw threshold
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

  // A mismatch that survived the draw threshold (any nonzero frequency, here
  // ~20% — well under the old fixed 50% click cutoff) is drawn as signal, so it
  // must be clickable: clickability tracks draw-visibility, not a separate cutoff.
  it('a mismatch surviving the draw threshold is clickable even below 50%', () => {
    const resolved = {
      ...makeResolved({
        mismatchPositions: new Uint32Array([1000]),
        mismatchYs: new Uint16Array([0]),
        mismatchBases: new Uint8Array([65]),
        mismatchFrequencies: new Uint8Array([50]), // ~20%, survived the threshold
      }),
      bpRange: [0, 2000] as [number, number],
    }
    const result = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('mismatch')
    }
  })

  // Small insertions gate on frequency identically to mismatches — and, like
  // mismatches, the gate must lift when the user turns frequency filtering off
  // (their draw fade lifts too). bpRange=[0,2000] → bpPerPx=10; pos=1000 sits
  // under canvasX=100.
  function lowFreqInsertionZoomedOut() {
    return {
      ...makeResolved({
        interbasePositions: new Uint32Array([1000]),
        interbaseYs: new Uint16Array([0]),
        interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
        interbaseLengths: new Uint32Array([1]), // < LONG_INSERTION_MIN_LENGTH → 'small'
        interbaseSequences: ['A'],
        interbaseFrequencies: new Uint8Array([0]), // filtered out by draw threshold
      }),
      bpRange: [0, 2000] as [number, number],
    }
  }

  it('low-frequency small insertion is not clickable when frequency filtering is on', () => {
    const result = performHitTest(
      100,
      60,
      lowFreqInsertionZoomedOut(),
      ZOOMED_OUT_OPTS,
    )
    expect(result.type).not.toBe('cigar')
  })

  it('low-frequency small insertion stays clickable when frequency filtering is off', () => {
    const result = performHitTest(100, 60, lowFreqInsertionZoomedOut(), {
      ...ZOOMED_OUT_OPTS,
      filterMismatchesByFrequency: false,
    })
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('insertion')
    }
  })
})

describe('contextMenuTargetForHit', () => {
  const resolved = makeResolved()
  // 200px across 20000bp, so canvas x=1 is the column at bp 100
  const CANVAS_X = 1
  const CLICKED_COLUMN = 100

  it('a miss resolves no target, so the browser keeps the menu', () => {
    expect(contextMenuTargetForHit({ type: 'none' }, CANVAS_X)).toBeUndefined()
  })

  // The depth histogram has a widget behind it, so it gets a menu like every
  // other mark that does. Only an arc — whose feed is junctions, with nothing
  // to open — still falls through.
  it('a coverage hit carries the coverage hit but no feature', () => {
    const cov = { type: 'coverage', position: 1 } as const
    const target = contextMenuTargetForHit(
      { type: 'coverage', hit: cov, resolved },
      CANVAS_X,
    )
    expect(target?.hit.coverageHit).toBe(cov)
    expect(target?.featureId).toBeUndefined()
  })

  // Every target carries the block it was resolved in and the column the cursor
  // was on, whatever mark answered — the position sorts anchor on that column.
  it('every hit carries its block and the clicked column', () => {
    expect(
      contextMenuTargetForHit(
        { type: 'feature', hit: { id: 'r1', index: 3 }, resolved },
        CANVAS_X,
      ),
    ).toEqual({
      hit: { block: resolved, genomicPos: CLICKED_COLUMN },
      featureId: 'r1',
    })
  })

  it('a cigar hit carries both the cigar hit and its read feature id', () => {
    const cigar = {
      type: 'mismatch',
      index: 0,
      position: 42,
      length: 1,
    } as const
    expect(
      contextMenuTargetForHit(
        {
          type: 'cigar',
          hit: cigar,
          featureHit: { id: 'r2', index: 1 },
          resolved,
        },
        CANVAS_X,
      ),
    ).toEqual({
      hit: { block: resolved, genomicPos: CLICKED_COLUMN, cigarHit: cigar },
      featureId: 'r2',
    })
  })

  // regression: a modification hit used to fall through to the native browser
  // menu; it must expose the read's feature id, the base's cigar hit, and the
  // mod hit itself (so "Open modification details" is reachable from the menu).
  it('a modification hit exposes the mod hit, cigar hit, and read feature id', () => {
    const cigar = {
      type: 'mismatch',
      index: 0,
      position: 7,
      length: 1,
      base: 'A',
    } as const
    const mod = {
      position: 7,
      modType: 'm',
      noMod: false,
      probability: 0.9,
      color: '#f00',
    }
    const target = contextMenuTargetForHit(
      {
        type: 'modification',
        hit: mod,
        featureHit: { id: 'r3', index: 2 },
        cigarHit: cigar,
        resolved,
      },
      CANVAS_X,
    )
    expect(target).toEqual({
      hit: {
        block: resolved,
        genomicPos: CLICKED_COLUMN,
        cigarHit: cigar,
        modHit: mod,
      },
      featureId: 'r3',
    })
  })

  it('an indicator hit carries the indicator hit but no feature', () => {
    const ind = {
      type: 'indicator' as const,
      position: 100,
      indicatorType: 'insertion' as const,
    }
    const target = contextMenuTargetForHit(
      { type: 'indicator', hit: ind, resolved },
      CANVAS_X,
    )
    expect(target?.hit.indicatorHit).toBe(ind)
    expect(target?.featureId).toBeUndefined()
  })
})

// A flipped region runs bp leftward, so the un-rounded canvas-X inverse lands in
// (b, b+1] rather than [b, b+1). Flooring it — which every per-base test used to
// do — named b+1 on base b's leftmost pixel column, and named `end` (outside the
// block) on the block's first column. canvasXToBasePos owns that pivot.
describe('reversed block resolves the base actually painted under the cursor', () => {
  // 10bp across 100px, flipped: base 1009 owns pixels [0,10), 1000 owns [90,100)
  function reversedBlock(rpcOverrides: Partial<PileupDataResult> = {}) {
    return {
      ...makeResolved(rpcOverrides),
      bpRange: [1000, 1010] as [number, number],
      blockWidth: 100,
      reversed: true,
    }
  }

  it('hits the mismatch on that base leftmost pixel column', () => {
    const resolved = reversedBlock({
      mismatchPositions: new Uint32Array([1008]),
      mismatchYs: new Uint16Array([0]),
      mismatchBases: new Uint8Array([65]),
    })
    // x=10 is base 1008's first column; flooring resolved it as 1009
    const result = performHitTest(10, 60, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.position).toBe(1008)
    }
  })

  it('does not hit the neighbouring base mismatch', () => {
    const resolved = reversedBlock({
      mismatchPositions: new Uint32Array([1009]),
      mismatchYs: new Uint16Array([0]),
      mismatchBases: new Uint8Array([65]),
    })
    expect(performHitTest(10, 60, resolved, ZOOMED_OUT_OPTS).type).toBe('none')
  })

  it('resolves a coverage bin on the first pixel column', () => {
    const resolved = reversedBlock({
      coverageDepths: new Float32Array(10).fill(10),
      coverageStartPos: 1000,
    })
    // x=0 is the block's leftmost column, showing the region's LAST base.
    // Flooring gave 1010 — one past the bin array, so the column reported no
    // coverage at all.
    const result = performHitTest(0, 30, resolved, ZOOMED_OUT_OPTS)
    expect(result.type).toBe('coverage')
    if (result.type === 'coverage') {
      expect(result.hit.position).toBe(1009)
    }
  })
})

// Chain mode puts a chain's mates on one row, and `chainFlatbush` boxes the
// chain's whole minStart..maxEnd extent so the connecting line between mates is
// hoverable. The chain box must NOT win over a read the cursor is actually on:
// resolving to `chainFirstReadIndices` there described mate 1 while the cursor
// sat on mate 2, so the tooltip, feature details, and context menu all named the
// wrong read.
describe('chain mode resolves the read under the cursor, not the chain first read', () => {
  const CHAIN_OPTS: HitTestOptions = { ...ZOOMED_OUT_OPTS, isChainMode: true }

  // One chain, two mates on row 0: mate1 [0,2000], mate2 [16000,18000].
  // 200px over [0,20000] → bpPerPx=100, so x=5 → bp 500, x=170 → bp 17000,
  // x=100 → bp 10000 (the gap between mates).
  function chainBlock() {
    const chainFlatbush = new Flatbush(1)
    chainFlatbush.add(0, 0, 18000, 0)
    chainFlatbush.finish()
    return makeResolved({
      readKeys: ['mate1', 'mate2'],
      readPositions: new Uint32Array([0, 2000, 16000, 18000]),
      readYs: new Uint16Array([0, 0]),
      chainFirstReadIndices: new Uint32Array([0]),
      chainFlatbush,
    })
  }

  it('hovering the second mate resolves the second mate', () => {
    const result = performHitTest(170, 60, chainBlock(), CHAIN_OPTS)
    expect(result.type).toBe('feature')
    if (result.type === 'feature') {
      expect(result.hit).toStrictEqual({ id: 'mate2', index: 1 })
    }
  })

  it('hovering the first mate resolves the first mate', () => {
    const result = performHitTest(5, 60, chainBlock(), CHAIN_OPTS)
    expect(result.type).toBe('feature')
    if (result.type === 'feature') {
      expect(result.hit).toStrictEqual({ id: 'mate1', index: 0 })
    }
  })

  it('hovering the connecting line between mates falls back to the chain', () => {
    const result = performHitTest(100, 60, chainBlock(), CHAIN_OPTS)
    expect(result.type).toBe('feature')
    if (result.type === 'feature') {
      expect(result.hit).toStrictEqual({ id: 'mate1', index: 0 })
    }
  })

  // The one row where chain boxes overlap: `placeRectCapped` piles every
  // truncated chain onto the `maxRows` sentinel, so a point query returns
  // several boxes that all contain the cursor. `hits[0]` is Flatbush's packed
  // Hilbert order — for one row's collinear boxes the LEFTMOST — which named
  // whichever chain started furthest left rather than the line drawn on top.
  //
  // maxRows=2 here: rows 0 and 1 are real, row 2 is the sentinel. topOffset 50 +
  // rowHeight 12 puts row 2 at canvasY 74..84, and x=100 is bp 10000, inside
  // both chains' extents but inside neither one's reads.
  it('the overflow row resolves the chain drawn last, not the leftmost', () => {
    const chainFlatbush = new Flatbush(2)
    chainFlatbush.add(0, 2, 18000, 2)
    chainFlatbush.add(8000, 2, 19000, 2)
    chainFlatbush.finish()
    const resolved = makeResolved({
      readKeys: ['c0mate1', 'c0mate2', 'c1mate1', 'c1mate2'],
      readPositions: new Uint32Array([
        0, 2000, 16000, 18000, 8000, 9000, 18000, 19000,
      ]),
      readYs: new Uint16Array([2, 2, 2, 2]),
      chainFirstReadIndices: new Uint32Array([0, 2]),
      chainFlatbush,
      maxY: 2,
      clippedBy: 'ceiling',
    })
    const result = performHitTest(100, 80, resolved, CHAIN_OPTS)
    expect(result.type).toBe('feature')
    if (result.type === 'feature') {
      expect(result.hit).toStrictEqual({ id: 'c1mate1', index: 2 })
    }
  })
})

// `deletion` / `mismatch` / `insertion` are the three PILEUP_LAYERS entries
// gated on showMismatches, and the flag is a repaint-tier setting — the arrays
// are still fetched. So without a matching gate here the marks stayed hoverable,
// clickable and right-clickable while nothing was drawn for them.
describe('showMismatches off stops hit-testing the layers it stops drawing', () => {
  const NO_MISMATCHES: HitTestOptions = {
    ...ZOOMED_OUT_OPTS,
    showMismatches: false,
  }

  // bpPerPx=1 (bpRange [0,200] over 200px) — the zoomed-in branch.
  function zoomedIn(rpcOverrides: Partial<PileupDataResult> = {}) {
    return {
      ...makeResolved(rpcOverrides),
      bpRange: [0, 200] as [number, number],
    }
  }

  it('a mismatch is inert', () => {
    const resolved = zoomedIn({
      mismatchPositions: new Uint32Array([100]),
      mismatchYs: new Uint16Array([0]),
      mismatchBases: new Uint8Array([65]),
    })
    expect(performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS).type).toBe(
      'cigar',
    )
    expect(performHitTest(100, 60, resolved, NO_MISMATCHES).type).toBe('none')
  })

  it('an insertion is inert', () => {
    const resolved = zoomedIn({
      interbasePositions: new Uint32Array([100]),
      interbaseYs: new Uint16Array([0]),
      interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
      interbaseLengths: new Uint32Array([1]),
      interbaseSequences: ['A'],
      interbaseFrequencies: new Uint8Array([255]),
    })
    expect(performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS).type).toBe(
      'cigar',
    )
    expect(performHitTest(100, 60, resolved, NO_MISMATCHES).type).toBe('none')
  })

  // The sharpest case: a deletion draws no gap mark, and the read body is NOT
  // split at deletions (only at skips), so the read is a solid block there. The
  // gap test went on intercepting the whole span, making that read unselectable
  // across its own deletion.
  it('a deletion hands the click back to the read it is drawn inside', () => {
    const resolved = zoomedIn({
      gapPositions: new Uint32Array([50, 150]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([GAP_DELETION]),
      readPositions: new Uint32Array([0, 200]),
      readYs: new Uint16Array([0]),
      readKeys: ['read1'],
    })
    expect(performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS).type).toBe(
      'cigar',
    )
    const off = performHitTest(100, 60, resolved, NO_MISMATCHES)
    expect(off.type).toBe('feature')
    if (off.type === 'feature') {
      expect(off.hit).toStrictEqual({ id: 'read1', index: 0 })
    }
  })

  it('the zoomed-out deletion branch is gated too', () => {
    const resolved = makeResolved({
      gapPositions: new Uint32Array([9500, 10500]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([GAP_DELETION]),
    })
    expect(performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS).type).toBe(
      'cigar',
    )
    expect(performHitTest(100, 60, resolved, NO_MISMATCHES).type).toBe('none')
  })

  // The `skip` half of the same array is its own layer and draws
  // unconditionally, so the flag must take the deletion bars out of the gap
  // test without taking the intron centerlines with them.
  it('a skip stays hittable', () => {
    const resolved = zoomedIn({
      gapPositions: new Uint32Array([50, 150]),
      gapYs: new Uint16Array([0]),
      gapTypes: new Uint8Array([GAP_SKIP]),
      readPositions: new Uint32Array([0, 200]),
      readYs: new Uint16Array([0]),
      readKeys: ['read1'],
    })
    for (const opts of [ZOOMED_OUT_OPTS, NO_MISMATCHES]) {
      const hit = performHitTest(100, 60, resolved, opts)
      expect(hit.type).toBe('cigar')
      if (hit.type === 'cigar') {
        expect(hit.hit.type).toBe('skip')
      }
    }
  })

  // `findTopmostOnRow` answers with ONE gap per row, so an undrawn deletion has
  // to be excluded from the search rather than lose a tie — otherwise a
  // collapsed group, where every read sits on row 0, hands back the deletion of
  // a read painted under the spliced one and the junction stops answering.
  it('a deletion above a skip on one row does not mask it', () => {
    const resolved = zoomedIn({
      gapPositions: new Uint32Array([50, 150, 60, 140]),
      gapYs: new Uint16Array([0, 0]),
      gapTypes: new Uint8Array([GAP_SKIP, GAP_DELETION]),
      readPositions: new Uint32Array([0, 200]),
      readYs: new Uint16Array([0]),
      readKeys: ['read1'],
    })
    const on = performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS)
    expect(on.type === 'cigar' && on.hit.type).toBe('deletion')
    const off = performHitTest(100, 60, resolved, NO_MISMATCHES)
    expect(off.type === 'cigar' && off.hit.type).toBe('skip')
  })

  // Clips draw unconditionally (PILEUP_LAYERS gates them on `() => true`), so
  // they must stay hittable — the gate covers the mark layers, not this one.
  it('a soft clip stays hittable', () => {
    const resolved = zoomedIn({
      interbasePositions: new Uint32Array([100]),
      interbaseYs: new Uint16Array([0]),
      interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP]),
      interbaseLengths: new Uint32Array([20]),
      interbaseFrequencies: new Uint8Array([255]),
    })
    const off = performHitTest(100, 60, resolved, NO_MISMATCHES)
    expect(off.type).toBe('cigar')
    if (off.type === 'cigar') {
      expect(off.hit.type).toBe('softclip')
    }
  })
})

// `readPositions` carries the read's TRUE aligned extent — soft-clip expansion
// is applied to the layout's extents and never written back — so hitTestFeature
// finds nothing over the clipped tail that drawSoftclipBases paints. Left
// unhandled, the visible run answered no hover, cleared the selection on click,
// and fell through to the browser's own context menu on right-click.
describe('soft-clipped bases resolve to their read', () => {
  // bpPerPx=1; read aligned over [0,100], 20 clipped bases drawn at [100,120).
  function clippedRead() {
    return {
      ...makeResolved({
        readPositions: new Uint32Array([0, 100]),
        readYs: new Uint16Array([0]),
        readKeys: ['read1'],
        softclipBasePositions: new Uint32Array(
          Array.from({ length: 20 }, (_, k) => 100 + k),
        ),
        softclipBaseYs: new Uint16Array(20),
        softclipBaseReadIndices: new Uint32Array(20),
      }),
      bpRange: [0, 200] as [number, number],
    }
  }

  it('hovering past the alignment end still names the read', () => {
    // x=110 → bp 110, outside readPositions [0,100] but inside the clipped run
    const result = performHitTest(110, 60, clippedRead(), ZOOMED_OUT_OPTS)
    expect(result.type).toBe('feature')
    if (result.type === 'feature') {
      expect(result.hit).toStrictEqual({ id: 'read1', index: 0 })
    }
  })

  it('the aligned body still wins where the two could overlap', () => {
    const result = performHitTest(50, 60, clippedRead(), ZOOMED_OUT_OPTS)
    expect(result.type).toBe('feature')
    if (result.type === 'feature') {
      expect(result.hit).toStrictEqual({ id: 'read1', index: 0 })
    }
  })

  it('past the end of the clipped run is still a miss', () => {
    expect(performHitTest(130, 60, clippedRead(), ZOOMED_OUT_OPTS).type).toBe(
      'none',
    )
  })

  it('another row is a miss', () => {
    // canvasY=72 → adjustedY=22 → row 1; the clip bases are all on row 0
    expect(performHitTest(110, 72, clippedRead(), ZOOMED_OUT_OPTS).type).toBe(
      'none',
    )
  })
})

// The clip test was the one mark hit-test with no significance gate, though the
// clip shader fades by the same `interbaseFrequencies` byte the mismatch and
// small-insertion tests read through passesFrequencyGate.
describe('clip hit gates on frequency like every other mark', () => {
  // bpPerPx=10 (bpRange [0,2000] over 200px) — past base level, so the gate is
  // live; frequency 0 = zeroed by the depth-dependent draw threshold.
  function lowFreqClip() {
    return {
      ...makeResolved({
        interbasePositions: new Uint32Array([1000]),
        interbaseYs: new Uint16Array([0]),
        interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP]),
        interbaseLengths: new Uint32Array([20]),
        interbaseFrequencies: new Uint8Array([0]),
      }),
      bpRange: [0, 2000] as [number, number],
    }
  }

  it('a noise-floor clip does not intercept', () => {
    expect(performHitTest(100, 60, lowFreqClip(), ZOOMED_OUT_OPTS).type).toBe(
      'none',
    )
  })

  it('but stays hittable with frequency filtering off', () => {
    const result = performHitTest(100, 60, lowFreqClip(), {
      ...ZOOMED_OUT_OPTS,
      filterMismatchesByFrequency: false,
    })
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('softclip')
    }
  })
})

// `clip` is the one PILEUP_LAYERS entry with `enabled: () => true`, and
// `drawClipBars` honours that literally: a fixed 1px bar at every zoom, opaque
// unless the worker zeroed its frequency. The priority chain used to be spelled
// twice — once in `hitTestCigarItem` for the zoomed-in branch, once inline for
// the zoomed-out one — and clips were absent from the second copy, so above
// `SNP_HIT_MAX_BP_PER_PX` a drawn bar answered nothing and the hover fell
// through to the read body. `hitTestGateParity.test.ts` cannot see this: it
// varies settings, never zoom.
describe('clips stay hittable when zoomed out, as they stay drawn', () => {
  // ZOOMED_OUT_OPTS' block is [0,20000] over 200px → bpPerPx=100, four times
  // SNP_HIT_MAX_BP_PER_PX. canvasX=100 → genomicPos=10000; canvasY=60 → row 0.
  function clipAtCursor(type: number, frequency = 255) {
    return makeResolved({
      interbasePositions: new Uint32Array([10000]),
      interbaseYs: new Uint16Array([0]),
      interbaseTypes: new Uint8Array([type]),
      interbaseLengths: new Uint32Array([20]),
      interbaseFrequencies: new Uint8Array([frequency]),
    })
  }

  it('a soft clip answers past the per-base zoom threshold', () => {
    const result = performHitTest(
      100,
      60,
      clipAtCursor(INTERBASE_SOFTCLIP),
      ZOOMED_OUT_OPTS,
    )
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('softclip')
    }
  })

  it('a hard clip does too', () => {
    const result = performHitTest(
      100,
      60,
      clipAtCursor(INTERBASE_HARDCLIP),
      ZOOMED_OUT_OPTS,
    )
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('hardclip')
    }
  })

  // Clips are not a `showMismatches` layer, so the flag that silences the mark
  // layers must leave them alone at this zoom exactly as it does zoomed in.
  it('and is unaffected by showMismatches, which does not gate its layer', () => {
    const result = performHitTest(100, 60, clipAtCursor(INTERBASE_SOFTCLIP), {
      ...ZOOMED_OUT_OPTS,
      showMismatches: false,
    })
    expect(result.type).toBe('cigar')
    if (result.type === 'cigar') {
      expect(result.hit.type).toBe('softclip')
    }
  })

  // The gate that DOES apply still applies: a zeroed clip hands the click back.
  it('but a noise-floor clip still declines', () => {
    const resolved = clipAtCursor(INTERBASE_SOFTCLIP, 0)
    expect(performHitTest(100, 60, resolved, ZOOMED_OUT_OPTS).type).toBe('none')
  })
})
