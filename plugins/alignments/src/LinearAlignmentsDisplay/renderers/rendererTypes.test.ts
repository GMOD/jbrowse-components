import {
  computeArcBand,
  interbaseRangeEnds,
  pileupCellWidth,
} from './rendererTypes.ts'

import type { ArcBandInput, RenderState } from './rendererTypes.ts'

// Contiguous base walls take a half-pixel overdraw to close Canvas2D
// anti-aliasing seams; sparse marks don't.
describe('pileup cell width', () => {
  it('floors at 1px when zoomed out past 1 bp/px', () => {
    expect(pileupCellWidth(4, false)).toBe(1)
    expect(pileupCellWidth(4, true)).toBe(1.5)
  })

  it('tracks pixels-per-bp when zoomed in', () => {
    expect(pileupCellWidth(0.25, false)).toBe(4)
    expect(pileupCellWidth(0.25, true)).toBe(4.5)
  })

  it('adds exactly the seam fudge for contiguous walls', () => {
    for (const bpPerPx of [0.1, 0.5, 1, 2]) {
      expect(
        pileupCellWidth(bpPerPx, true) - pileupCellWidth(bpPerPx, false),
      ).toBeCloseTo(0.5)
    }
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
    linkRegions: [],
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
