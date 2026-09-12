import {
  buildReadIdToIndex,
  computeArcBand,
  interbaseRangeEnds,
  makePileupCellMapper,
} from './rendererTypes.ts'

import type { ArcBandInput, DrawBlock, RenderState } from './rendererTypes.ts'

// The 1bp-cell Canvas2D painters (mismatch, modification, per-base
// quality/letter, soft-clip bases) all size their rects through
// makePileupCellMapper so the seam-fudge rule can't drift between them.
// Contiguous base walls take a half-pixel overdraw to close Canvas2D
// anti-aliasing seams; sparse marks don't.
const BLOCK_WIDTH = 100
const block: DrawBlock = { start: 0, end: 0, screenStartPx: 0 }

// bpPerPx is bpLength/fullBlockWidth, so pin the width and vary bpLength.
function widthAt(bpPerPx: number, contiguous: boolean) {
  return makePileupCellMapper(
    block,
    bpPerPx * BLOCK_WIDTH,
    BLOCK_WIDTH,
    contiguous,
  ).w
}

describe('pileup cell width', () => {
  it('floors at 1px when zoomed out past 1 bp/px', () => {
    expect(widthAt(4, false)).toBe(1)
    // Contiguous walls still take the fudge on top of the floor.
    expect(widthAt(4, true)).toBe(1.5)
  })

  it('tracks pixels-per-bp when zoomed in', () => {
    // bpPerPx 0.25 → 4 px/bp
    expect(widthAt(0.25, false)).toBe(4)
    expect(widthAt(0.25, true)).toBe(4.5)
  })

  it('adds exactly the seam fudge for contiguous walls', () => {
    for (const bpPerPx of [0.1, 0.5, 1, 2]) {
      expect(widthAt(bpPerPx, true) - widthAt(bpPerPx, false)).toBeCloseTo(0.5)
    }
  })
})

// `bpToScreenX` is the cell's left edge only on a forward block; a reversed
// block runs bp leftward, putting it on the cell's right edge. cellX folds that
// pivot in so a painter's `fillRect(cellX(bp), y, w, h)` covers bp either way.
describe('makePileupCellMapper cellX', () => {
  // bp 100..110 across 100px => 10 px/bp. bp 100 owns [0,10] forward, and is
  // the rightmost base — owning [90,100] — reversed.
  const span: DrawBlock = { start: 100, end: 110, screenStartPx: 0 }
  const mapper = (reversed: boolean) =>
    makePileupCellMapper({ ...span, reversed }, 10, BLOCK_WIDTH, false)

  it('forward: cellX is the base cell left edge', () => {
    expect(mapper(false).cellX(100)).toBeCloseTo(0)
    expect(mapper(false).cellX(105)).toBeCloseTo(50)
  })

  it('reversed: cellX still lands on the left edge of that same base', () => {
    expect(mapper(true).cellX(100)).toBeCloseTo(90)
    expect(mapper(true).cellX(105)).toBeCloseTo(40)
  })

  it('respects screenStartPx offset', () => {
    const m = makePileupCellMapper(
      { ...span, screenStartPx: 20 },
      10,
      BLOCK_WIDTH,
      false,
    )
    expect(m.cellX(100)).toBeCloseTo(20)
  })
})

// Both take the coverage band as its RESERVED height now, so the one helper
// serves the render state and `computeArcBand` with a single field.
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
    coverageReservedPx: 0,
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
          coverageReservedPx: 80,
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
          coverageReservedPx: 0,
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
          coverageReservedPx: 80,
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
          coverageReservedPx: 0,
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
          coverageReservedPx: 80,
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
          coverageReservedPx: 0,
        }),
      ),
    ).toEqual({ top: 0, height: 60, down: true })
  })
})
