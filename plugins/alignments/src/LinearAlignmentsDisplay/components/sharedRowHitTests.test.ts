import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import { performHitTest } from './hitTestPipeline.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { HitTestOptions } from './hitTestPipeline.ts'

/**
 * A collapsed group puts EVERY read of the group on row 0 — `readYs` is an
 * all-zero array by construction (`buildCollapsedPileupMap`) — and overlap is
 * the normal case there, not an edge one: the whole point of the mode is that
 * the overlap tint carries depth. Chain mode shares rows the same way.
 *
 * So on that row two reads' marks land on one pixel, and the pixel belongs to
 * whichever draws last. Both backends draw one instanced pass per feature kind
 * in array order, and the arrays are built per read in read order, so that is
 * the LAST matching entry.
 *
 * Each test below hovers a spot where two reads on row 0 overlap and both carry
 * a mark. The mark must come from the same read `hitTestFeature` names beside it
 * — `performHitTest` attaches `featureHit` to every cigar hit, and the tooltip,
 * the details widget and the right-click menu read the two together. Scanning
 * the mark arrays forwards while `hitTestFeature` scanned backwards paired the
 * top read's identity with the covered read's base, quality and position.
 */

// Two reads, both on row 0, both spanning the cursor at genomicPos 100.
// Index 1 is drawn second, so it is the one on top.
const TWO_OVERLAPPING_READS = {
  readKeys: ['under', 'over'],
  readYs: new Uint16Array([0, 0]),
  readPositions: new Uint32Array([0, 200, 50, 200]),
}

function makeRpcData(overrides: Partial<PileupDataResult>): PileupDataResult {
  const data = {
    mismatchPositions: new Uint32Array(),
    mismatchFrequencies: new Uint8Array(),
    mismatchQuals: new Uint8Array(),
    mismatchBases: new Uint8Array(),
    mismatchYs: new Uint16Array(),
    interbaseFrequencies: new Uint8Array(),
    interbasePositions: new Uint32Array(),
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint32Array(),
    interbaseTypes: new Uint8Array(),
    interbaseSequences: [],
    gapPositions: new Uint32Array(),
    gapYs: new Uint16Array(),
    gapTypes: new Uint8Array(),
    modificationPositions: new Uint32Array(),
    modificationYs: new Uint16Array(),
    modificationColors: new Uint32Array(),
    softclipBasePositions: new Uint32Array(),
    softclipBaseYs: new Uint16Array(),
    softclipBaseReadIndices: new Uint32Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    ...TWO_OVERLAPPING_READS,
    ...overrides,
  } as PileupDataResult
  const types = data.interbaseTypes
  const count = (code: number) => types.filter(t => t === code).length
  return {
    ...data,
    numInsertions: count(INTERBASE_INSERTION),
    numSoftclips: count(INTERBASE_SOFTCLIP),
    numHardclips: count(INTERBASE_HARDCLIP),
  }
}

// bpRange [0,200] over 200px → bpPerPx 1, so canvasX 100 → genomicPos 100.
// Coverage band is the top 50px; canvasY 60 is row 0 of the pileup.
function makeResolved(overrides: Partial<PileupDataResult>): ResolvedBlock {
  return {
    rpcData: makeRpcData(overrides),
    bpRange: [0, 200],
    blockStartPx: 0,
    blockWidth: 200,
    refName: 'chr1',
    reversed: false,
  }
}

const OPTS: HitTestOptions = {
  showCoverage: false,
  showInterbaseIndicators: false,
  coverageHeight: 50,
  coverageMaxDepth: undefined,
  coverageSnpMinFrequency: 0,
  topOffset: 50,
  coverageTopOffset: 0,
  featureHeight: 10,
  featureSpacing: 2,
  scrollTop: 0,
  isChainMode: false,
  filterMismatchesByFrequency: false,
  showMismatches: true,
  pileupVisible: true,
}

function hover(resolved: ResolvedBlock) {
  return performHitTest(100, 60, resolved, OPTS)
}

it('the read under the cursor is the last one drawn', () => {
  const result = hover(makeResolved({}))
  expect(result.type).toBe('feature')
  if (result.type === 'feature') {
    expect(result.hit.id).toBe('over')
  }
})

it('a mismatch resolves to the read whose pixel is on top', () => {
  // both reads mismatch at base 100: 'under' calls A, 'over' calls C
  const result = hover(
    makeResolved({
      mismatchPositions: new Uint32Array([100, 100]),
      mismatchYs: new Uint16Array([0, 0]),
      mismatchBases: new Uint8Array([65, 67]),
      mismatchQuals: new Uint8Array([10, 40]),
      mismatchFrequencies: new Uint8Array([255, 255]),
    }),
  )
  expect(result.type).toBe('cigar')
  if (result.type === 'cigar') {
    // the allele and the read must be the same read's
    expect(result.hit.base).toBe('C')
    expect(result.hit.qual).toBe(40)
    expect(result.featureHit?.id).toBe('over')
  }
})

it('a deletion resolves to the read whose pixel is on top', () => {
  const result = hover(
    makeResolved({
      // 'under' has a 60bp deletion over the cursor, 'over' a 20bp one
      gapPositions: new Uint32Array([80, 140, 95, 115]),
      gapYs: new Uint16Array([0, 0]),
      gapTypes: new Uint8Array([0, 0]),
    }),
  )
  expect(result.type).toBe('cigar')
  if (result.type === 'cigar') {
    expect(result.hit.length).toBe(20)
    expect(result.featureHit?.id).toBe('over')
  }
})

it('an insertion resolves to the read whose pixel is on top', () => {
  const result = hover(
    makeResolved({
      interbasePositions: new Uint32Array([100, 100]),
      interbaseYs: new Uint16Array([0, 0]),
      interbaseLengths: new Uint32Array([30, 40]),
      interbaseTypes: new Uint8Array([
        INTERBASE_INSERTION,
        INTERBASE_INSERTION,
      ]),
      interbaseFrequencies: new Uint8Array([255, 255]),
      interbaseSequences: ['AAA', 'CCC'],
    }),
  )
  expect(result.type).toBe('cigar')
  if (result.type === 'cigar') {
    expect(result.hit.sequence).toBe('CCC')
    expect(result.featureHit?.id).toBe('over')
  }
})

it('a clip resolves to the read whose pixel is on top', () => {
  const result = hover(
    makeResolved({
      interbasePositions: new Uint32Array([100, 100]),
      interbaseYs: new Uint16Array([0, 0]),
      interbaseLengths: new Uint32Array([15, 25]),
      interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP, INTERBASE_SOFTCLIP]),
      interbaseFrequencies: new Uint8Array([255, 255]),
    }),
  )
  expect(result.type).toBe('cigar')
  if (result.type === 'cigar') {
    expect(result.hit.type).toBe('softclip')
    expect(result.hit.length).toBe(25)
  }
})

// The two rules that meet in `hitTestClip` are independent, and fusing them into
// one forward scan silently collapsed the second into "whichever read is first".
// A softclip still outranks a hardclip at the same spot whatever the draw order,
// because that comes from the worker's array layout rather than from the scan.
it('a softclip still outranks a hardclip drawn after it', () => {
  const result = hover(
    makeResolved({
      interbasePositions: new Uint32Array([100, 100]),
      interbaseYs: new Uint16Array([0, 0]),
      interbaseLengths: new Uint32Array([15, 25]),
      interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP, INTERBASE_HARDCLIP]),
      interbaseFrequencies: new Uint8Array([255, 255]),
    }),
  )
  expect(result.type).toBe('cigar')
  if (result.type === 'cigar') {
    expect(result.hit.type).toBe('softclip')
    expect(result.hit.length).toBe(15)
  }
})

// `hitTestSoftclipBase` is the fallback for the run drawn past a read's aligned
// extent, and had the direction right already — pinned so the shared helper
// can't regress it.
it('a soft-clipped base resolves to the read whose cell is on top', () => {
  const result = hover(
    makeResolved({
      // no read spans the cursor, so the fallback chain reaches the clip bases
      readPositions: new Uint32Array([0, 20, 0, 20]),
      softclipBasePositions: new Uint32Array([100, 100]),
      softclipBaseYs: new Uint16Array([0, 0]),
      softclipBaseReadIndices: new Uint32Array([0, 1]),
    }),
  )
  expect(result.type).toBe('feature')
  if (result.type === 'feature') {
    expect(result.hit.id).toBe('over')
  }
})
