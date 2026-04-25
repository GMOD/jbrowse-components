import {
  buildReadIdToIndex,
  computeBlockHeights,
  ensureRegion,
  interbaseRangeEnds,
} from './rendererTypes.ts'
import { getChainBounds } from './chainOverlayUtils.ts'
import type { RenderState } from './rendererTypes.ts'

function makeState(overrides: Partial<RenderState> = {}): RenderState {
  return {
    bpRangeX: [0, 1000],
    rangeY: [0, 100],
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 2,
    showCoverage: false,
    coverageHeight: 50,
    coverageYOffset: 0,
    coverageMaxDepth: undefined,
    coverageIsLog: false,
    showMismatches: true,
    showSoftClipping: false,
    showInterbaseIndicators: false,
    showModifications: false,
    canvasWidth: 800,
    canvasHeight: 600,
    highlightedChainIds: [],
    selectedChainIds: [],
    colors: {} as RenderState['colors'],
    pairedArcsDown: false,
    pileupTopOffset: 50,
    ...overrides,
  }
}

describe('buildReadIdToIndex', () => {
  it('maps each id to its index', () => {
    const m = buildReadIdToIndex(['a', 'b', 'c'], 3)
    expect(m.get('a')).toBe(0)
    expect(m.get('b')).toBe(1)
    expect(m.get('c')).toBe(2)
  })

  it('respects the n limit', () => {
    const m = buildReadIdToIndex(['a', 'b', 'c'], 2)
    expect(m.get('a')).toBe(0)
    expect(m.get('b')).toBe(1)
    expect(m.has('c')).toBe(false)
  })

  it('returns empty map for n=0', () => {
    expect(buildReadIdToIndex([], 0).size).toBe(0)
  })
})

describe('interbaseRangeEnds', () => {
  it('computes cumulative ends', () => {
    const { insEnd, scEnd, hcEnd } = interbaseRangeEnds({
      numInsertions: 3,
      numSoftclips: 5,
      numHardclips: 2,
    })
    expect(insEnd).toBe(3)
    expect(scEnd).toBe(8)
    expect(hcEnd).toBe(10)
  })

  it('handles zeros', () => {
    const { insEnd, scEnd, hcEnd } = interbaseRangeEnds({
      numInsertions: 0,
      numSoftclips: 0,
      numHardclips: 0,
    })
    expect(insEnd).toBe(0)
    expect(scEnd).toBe(0)
    expect(hcEnd).toBe(0)
  })
})

describe('getChainBounds', () => {
  function makeRegion(
    ids: string[],
    starts: number[],
    ends: number[],
    ys: number[],
  ) {
    const readPositions = new Uint32Array(ids.length * 2)
    const readYs = new Uint16Array(ids.length)
    for (let i = 0; i < ids.length; i++) {
      readPositions[i * 2] = starts[i]!
      readPositions[i * 2 + 1] = ends[i]!
      readYs[i] = ys[i]!
    }
    return {
      readIdToIndex: buildReadIdToIndex(ids, ids.length),
      readPositions,
      readYs,
    }
  }

  it('returns undefined for empty id list', () => {
    const region = makeRegion(['a'], [100], [200], [0])
    expect(getChainBounds([], region)).toBeUndefined()
  })

  it('returns undefined when no ids match', () => {
    const region = makeRegion(['a'], [100], [200], [0])
    expect(getChainBounds(['z'], region)).toBeUndefined()
  })

  it('returns bounds for a single read', () => {
    const region = makeRegion(['r1'], [1000], [2000], [3])
    const bounds = getChainBounds(['r1'], region)
    expect(bounds).toEqual({ minStart: 1000, maxEnd: 2000, y: 3 })
  })

  it('computes union bounds across multiple reads', () => {
    const region = makeRegion(
      ['r1', 'r2', 'r3'],
      [500, 1000, 200],
      [800, 1500, 600],
      [1, 2, 0],
    )
    const bounds = getChainBounds(['r1', 'r2', 'r3'], region)
    expect(bounds?.minStart).toBe(200)
    expect(bounds?.maxEnd).toBe(1500)
  })

  it('ignores ids not present in region', () => {
    const region = makeRegion(['r1', 'r2'], [100, 300], [200, 400], [0, 1])
    const bounds = getChainBounds(['r1', 'missing', 'r2'], region)
    expect(bounds?.minStart).toBe(100)
    expect(bounds?.maxEnd).toBe(400)
  })
})

describe('ensureRegion', () => {
  it('creates and inserts a new entry when absent', () => {
    const m = new Map<number, { v: number }>()
    const r = ensureRegion(m, 1, () => ({ v: 42 }))
    expect(r.v).toBe(42)
    expect(m.get(1)).toBe(r)
  })

  it('returns existing entry without calling factory', () => {
    const existing = { v: 99 }
    const m = new Map([[1, existing]])
    let called = false
    const r = ensureRegion(m, 1, () => { called = true; return { v: 0 } })
    expect(r).toBe(existing)
    expect(called).toBe(false)
  })
})

describe('computeBlockHeights', () => {
  it('returns zeros when both flags off', () => {
    const { effectiveArcsHeight, covH } = computeBlockHeights(makeState())
    expect(effectiveArcsHeight).toBe(0)
    expect(covH).toBe(0)
  })

  it('returns coverageHeight when showCoverage is on', () => {
    const { covH } = computeBlockHeights(makeState({ showCoverage: true, coverageHeight: 80 }))
    expect(covH).toBe(80)
  })

  it('returns arcsHeight when showArcs is on and arcsHeight is set', () => {
    const { effectiveArcsHeight } = computeBlockHeights(
      makeState({ showArcs: true, arcsHeight: 60 }),
    )
    expect(effectiveArcsHeight).toBe(60)
  })

  it('returns 0 for arcs when showArcs is true but arcsHeight is 0', () => {
    const { effectiveArcsHeight } = computeBlockHeights(
      makeState({ showArcs: true, arcsHeight: 0 }),
    )
    expect(effectiveArcsHeight).toBe(0)
  })
})
