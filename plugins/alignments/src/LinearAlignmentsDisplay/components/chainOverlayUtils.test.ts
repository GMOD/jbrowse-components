import {
  buildReadIdToIndex,
  computeArcBand,
  interbaseRangeEnds,
  lazyReadIdToIndex,
} from '../renderers/rendererTypes.ts'
import { getChainBounds } from './chainOverlayUtils.ts'

import type { ArcBandInput, RenderState } from '../renderers/rendererTypes.ts'

// `computeArcBand` keeps its own (showCoverage, raw height) input — the render
// state carries only the reserved height — so this helper serves both halves.
function makeState(
  overrides: Partial<RenderState & ArcBandInput> = {},
): RenderState & ArcBandInput {
  return {
    scrollTop: 0,
    readConnectionsLineWidth: 1,
    showOutline: false,
    readConnectionsDown: false,
    readConnectionsHeight: 100,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 2,
    showCoverage: false,
    coverageHeight: 50,
    coverageYOffset: 0,
    coverageMinDepth: undefined,
    coverageMaxDepth: undefined,
    coverageScaleType: 0 as const,
    coverageSymlogConstant: 1,
    coverageSnpMinFrequency: 0,
    showPerBaseQuality: false,
    showPerBaseLetter: false,
    showMismatches: true,
    filterMismatchesByFrequency: true,
    mismatchAlpha: false,
    showSoftClipping: false,
    showInterbaseIndicators: false,
    showModifications: false,
    canvasWidth: 800,
    canvasHeight: 600,
    selectedChainReadIds: [],
    colors: {} as RenderState['colors'],
    chainMode: false,
    readConnections: 'off',
    showLinkedReadLines: false,
    collapseGroupRows: false,
    pileupTopOffset: 50,
    coverageTopOffset: 0,
    sections: [
      {
        pileupTopOffset: 50,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: 600,
        pileupClipTop: 50,
        pileupClipHeight: 550,
      },
    ],
    ...overrides,
  }
}

describe('buildReadIdToIndex', () => {
  it('maps each id to its index', () => {
    const m = buildReadIdToIndex({
      readKeys: ['a', 'b', 'c'],
      readIdPrefix: undefined,
    })
    expect(m.get('a')).toBe(0)
    expect(m.get('b')).toBe(1)
    expect(m.get('c')).toBe(2)
  })

  // The numeric branch is where the string is built rather than read, so the
  // map's keys are what a hover matches `featureIdUnderMouse` against.
  it('spells numeric keys through the prefix', () => {
    const m = buildReadIdToIndex({
      readKeys: new Float64Array([7, 90210]),
      readIdPrefix: 'abc-',
    })
    expect(m.get('abc-7')).toBe(0)
    expect(m.get('abc-90210')).toBe(1)
  })

  it('returns empty map for no reads', () => {
    expect(
      buildReadIdToIndex({ readKeys: [], readIdPrefix: undefined }).size,
    ).toBe(0)
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
      readIdToIndex: lazyReadIdToIndex({
        readKeys: ids,
        readIdPrefix: undefined,
      }),
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
    expect(bounds).toEqual({ startBp: 1000, endBp: 2000, yRow: 3 })
  })

  it('computes union bounds across multiple reads', () => {
    const region = makeRegion(
      ['r1', 'r2', 'r3'],
      [500, 1000, 200],
      [800, 1500, 600],
      [1, 2, 0],
    )
    const bounds = getChainBounds(['r1', 'r2', 'r3'], region)
    expect(bounds?.startBp).toBe(200)
    expect(bounds?.endBp).toBe(1500)
  })

  it('ignores ids not present in region', () => {
    const region = makeRegion(['r1', 'r2'], [100, 300], [200, 400], [0, 1])
    const bounds = getChainBounds(['r1', 'missing', 'r2'], region)
    expect(bounds?.startBp).toBe(100)
    expect(bounds?.endBp).toBe(400)
  })
})

describe('computeArcBand', () => {
  it('is undefined when readConnections is off', () => {
    expect(computeArcBand(makeState())).toBeUndefined()
  })

  it('is undefined when readConnectionsHeight is 0', () => {
    expect(
      computeArcBand(
        makeState({ readConnections: 'arc', readConnectionsHeight: 0 }),
      ),
    ).toBeUndefined()
  })

  it('up mode overlays the coverage band when coverage is shown', () => {
    expect(
      computeArcBand(
        makeState({
          readConnections: 'arc',
          readConnectionsHeight: 60,
          showCoverage: true,
          coverageHeight: 80,
        }),
      ),
    ).toEqual({ top: 0, height: 80, down: false })
  })

  it('up mode takes its own band when coverage is hidden (decoupled)', () => {
    expect(
      computeArcBand(
        makeState({
          readConnections: 'arc',
          readConnectionsHeight: 60,
          showCoverage: false,
        }),
      ),
    ).toEqual({ top: 0, height: 60, down: false })
  })

  // The scalebar-label inset belongs to the coverage histogram: overlaying it
  // means anchoring on its baseline, which is coverageYOffset up from the
  // bottom. Every case above passes coverageYOffset: 0, so neither side of that
  // rule was pinned.
  it('up mode anchors on the coverage baseline, inset and all', () => {
    expect(
      computeArcBand(
        makeState({
          readConnections: 'arc',
          readConnectionsHeight: 60,
          showCoverage: true,
          coverageHeight: 80,
          coverageYOffset: 5,
        }),
      ),
    ).toEqual({ top: 0, height: 75, down: false })
  })

  it('up mode keeps its whole band when there is no coverage to inset from', () => {
    // `reservesArcsBand` reserves the full readConnectionsHeight here, so a
    // band shorter than that floats the arcs above the bottom of their own
    // strip and shortens availH — for a baseline that isn't on screen.
    expect(
      computeArcBand(
        makeState({
          readConnections: 'arc',
          readConnectionsHeight: 60,
          showCoverage: false,
          coverageYOffset: 5,
        }),
      ),
    ).toEqual({ top: 0, height: 60, down: false })
  })

  it('down mode sits below the coverage band', () => {
    expect(
      computeArcBand(
        makeState({
          readConnections: 'arc',
          readConnectionsHeight: 60,
          readConnectionsDown: true,
          showCoverage: true,
          coverageHeight: 80,
        }),
      ),
    ).toEqual({ top: 80, height: 60, down: true })
  })

  it('down mode renders at the top when coverage is hidden (decoupled)', () => {
    expect(
      computeArcBand(
        makeState({
          readConnections: 'arc',
          readConnectionsHeight: 60,
          readConnectionsDown: true,
          showCoverage: false,
        }),
      ),
    ).toEqual({ top: 0, height: 60, down: true })
  })
})
