import { drawMismatches } from './drawCanvas.ts'

import type { MismatchUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Records the fillStyle in effect at each fillRect, so we can read back the
// exact CSS color (and its alpha) the mismatch drew with, plus the rect's
// horizontal extent for the cell-geometry tests.
function recordingCtx() {
  const fills: string[] = []
  const rects: { x: number; w: number }[] = []
  let currentFill = ''
  const ctx = {
    set fillStyle(v: string) {
      currentFill = v
    },
    get fillStyle() {
      return currentFill
    },
    fillRect(x: number, _y: number, w: number) {
      fills.push(currentFill)
      rects.push({ x, w })
    },
  } as unknown as Ctx2D
  return { ctx, fills, rects }
}

// Full RenderState with a red 'A' base color. Only the fields drawMismatches
// reads matter; the rest are inert defaults. colors is populated just enough for
// buildBaseColorTupleMap (base A + the muted-modifications color).
function baseState(overrides: Partial<RenderState> = {}): RenderState {
  return {
    scrollTop: 0,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 0,
    showCoverage: false,
    coverageHeight: 0,
    coverageYOffset: 0,
    coverageMaxDepth: undefined,
    coverageIsLog: false,
    showMismatches: true,
    filterMismatchesByFrequency: false,
    mismatchAlpha: false,
    showSoftClipping: false,
    showInterbaseIndicators: false,
    showModifications: false,
    showPerBaseQuality: false,
    showPerBaseLetter: false,
    canvasWidth: 100,
    canvasHeight: 100,
    selectedChainIds: [],
    colors: {
      colorBaseA: [1, 0, 0],
      colorMutedSnpBase: [0.5, 0.5, 0.5],
    } as RenderState['colors'],
    linkedReads: 'off',
    showLinkedReadLines: false,
    flipStrandLongReadChains: false,
    colorSupplementaryChains: false,
    readConnectionsLineWidth: 1,
    readConnections: 'off',
    readConnectionsDown: false,
    readConnectionsHeight: 0,
    pileupTopOffset: 0,
    coverageTopOffset: 0,
    sections: [],
    showOutline: false,
    ...overrides,
  }
}

// One 'A' mismatch (base 65) at bp 100, full frequency, with the given quality.
function oneMismatch(qual: number): MismatchUploadData {
  return {
    mismatchPositions: new Uint32Array([100]),
    mismatchYs: new Uint16Array([0]),
    mismatchBases: new Uint8Array([65]),
    mismatchFrequencies: new Uint8Array([255]),
    mismatchQuals: new Uint8Array([qual]),
  }
}

// bp 100..110 across 100px => pxPerBp 10, so the frequency-fade branch (pxPerBp
// < 1) never fires and only the quality fade is under test.
const BLOCK: DrawBlock = { start: 100, end: 110, screenStartPx: 0 }
const BP_LENGTH = 10
const BLOCK_WIDTH = 100

function drawOne(state: RenderState, qual: number) {
  const { ctx, fills } = recordingCtx()
  drawMismatches(ctx, oneMismatch(qual), BLOCK, BP_LENGTH, BLOCK_WIDTH, state)
  return fills[0]
}

// A mismatch cell must cover its own base in both orientations. `bpToScreenX`
// returns the cell's *right* edge on a reversed block (bp runs leftward), so a
// painter that treats it as the left edge lands a full base off once a base is
// wider than a pixel — invisible zoomed out (width floors to 1px), glaring
// zoomed in. makePileupCellMapper owns that pivot for every 1bp-cell painter.
describe('drawMismatches cell geometry', () => {
  // BLOCK is bp 100..110 across 100px => 10 px/bp, so bp 100 owns [0,10]
  // forward. Reversed, bp 100 is the rightmost base and owns [90,100].
  const cellFor = (block: DrawBlock) => {
    const { ctx, rects } = recordingCtx()
    drawMismatches(
      ctx,
      oneMismatch(60),
      block,
      BP_LENGTH,
      BLOCK_WIDTH,
      baseState(),
    )
    return rects[0]!
  }

  test('forward block: cell covers its base', () => {
    const { x, w } = cellFor(BLOCK)
    expect(x).toBeCloseTo(0)
    expect(x + w).toBeCloseTo(10)
  })

  test('reversed block: cell covers its base, not the neighbor', () => {
    const { x, w } = cellFor({ ...BLOCK, reversed: true })
    expect(x).toBeCloseTo(90)
    expect(x + w).toBeCloseTo(100)
  })
})

describe('drawMismatches quality fade', () => {
  test('mismatchAlpha off: base is fully opaque regardless of quality', () => {
    expect(drawOne(baseState({ mismatchAlpha: false }), 10)).toBe(
      'rgb(255,0,0)',
    )
  })

  test('mismatchAlpha on: low quality fades toward transparent (qual/50)', () => {
    // Phred 25 => alpha 0.5
    expect(drawOne(baseState({ mismatchAlpha: true }), 25)).toBe(
      'rgba(255,0,0,0.5)',
    )
  })

  test('mismatchAlpha on: Phred 50+ stays fully opaque', () => {
    expect(drawOne(baseState({ mismatchAlpha: true }), 60)).toBe('rgb(255,0,0)')
  })

  test('mismatchAlpha on: quality 0 (no recorded quality) stays opaque', () => {
    expect(drawOne(baseState({ mismatchAlpha: true }), 0)).toBe('rgb(255,0,0)')
  })
})

// Deep-coverage scroll cost guard: the per-base mismatch pass must fill only the
// rows that reach the canvas band, not every fetched mismatch. Drops off if the
// pileupRowOffCanvas guard is removed.
describe('drawMismatches visible-row-band cull', () => {
  const rows = 1000
  // one 'A' mismatch per row, all at bp 100 (inside BLOCK); rowHeight 10.
  const deep: MismatchUploadData = {
    mismatchPositions: new Uint32Array(rows).fill(100),
    mismatchYs: Uint16Array.from({ length: rows }, (_, i) => i),
    mismatchBases: new Uint8Array(rows).fill(65),
    mismatchFrequencies: new Uint8Array(rows).fill(255),
    mismatchQuals: new Uint8Array(rows).fill(60),
  }
  const count = (state: RenderState) => {
    const { ctx, fills } = recordingCtx()
    drawMismatches(ctx, deep, BLOCK, BP_LENGTH, BLOCK_WIDTH, state)
    return fills.length
  }

  test('only the ~10 rows in the 100px canvas fill', () => {
    expect(count(baseState({ canvasHeight: 100 }))).toBeLessThan(20)
  })
  test('scrolled to the middle, still only the visible band fills', () => {
    expect(
      count(baseState({ canvasHeight: 100, scrollTop: 5000 })),
    ).toBeLessThan(20)
  })
  test('a canvas tall enough for every row fills them all (cull is a no-op)', () => {
    expect(count(baseState({ canvasHeight: 100000 }))).toBe(rows)
  })
})
