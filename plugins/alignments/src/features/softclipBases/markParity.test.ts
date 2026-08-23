import { bpAtPx, bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import { drawSoftclipBases } from './drawCanvas.ts'
import { hitTestSoftclipBase } from './hitTest.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { SoftclipBasesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draw against hit test, on the layer whose whole reason to have a hit test is
// that something IS painted where `hitTestFeature` finds nothing: the clipped
// tail is outside the read's aligned extent, so if these cells stop agreeing
// with their test the run goes back to answering nothing — the state the test
// was added for, and one no cross-backend gate can see, since both backends
// paint the run identically either way.

const START = 1000
const END = 1010
const BP_LENGTH = END - START
const BLOCK_WIDTH = 200
const BP_PER_PX = BP_LENGTH / BLOCK_WIDTH
const FEATURE_HEIGHT = 10

const CELLS: SoftclipBasesUploadData = {
  // A run of three on row 0 and one on row 1, so the sweep crosses a boundary
  // between abutting cells as well as the ends of the run.
  softclipBasePositions: new Uint32Array([1002, 1003, 1004, 1008]),
  softclipBaseYs: new Uint16Array([0, 0, 0, 1]),
  softclipBaseBases: new Uint8Array([65, 67, 71, 84]),
}

const RPC_DATA = {
  ...CELLS,
  softclipBaseReadIndices: new Uint32Array([0, 0, 0, 1]),
  readKeys: ['read-a', 'read-b'],
  readIdPrefix: undefined,
} as unknown as PileupDataResult

function state(): RenderState {
  return {
    featureHeight: FEATURE_HEIGHT,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    canvasHeight: 500,
    showModifications: false,
    colors: {
      colorBaseA: [0, 1, 0],
      colorBaseC: [0, 0, 1],
      colorBaseG: [1, 0.65, 0],
      colorBaseT: [1, 0, 0],
      colorBaseN: [0.4, 0.3, 0.2],
      colorMutedSnpBase: [0.5, 0.5, 0.5],
    },
  } as unknown as RenderState
}

function block(reversed: boolean): DrawBlock {
  return { start: START, end: END, screenStartPx: 0, reversed }
}

function bounds(reversed: boolean) {
  return {
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
}

function resolvedBlock(reversed: boolean): ResolvedBlock {
  return {
    rpcData: RPC_DATA,
    bpRange: [START, END],
    blockStartPx: 0,
    blockWidth: BLOCK_WIDTH,
    refName: 'ctgA',
    reversed,
  }
}

function recordingCtx() {
  const rects: { x: number; w: number }[] = []
  const ctx = {
    set fillStyle(_v: string) {},
    get fillStyle() {
      return ''
    },
    fillRect(x: number, _y: number, w: number) {
      rects.push({ x, w })
    },
  } as unknown as Ctx2D
  return { ctx, rects }
}

function oneCell(index: number): SoftclipBasesUploadData {
  return {
    softclipBasePositions: CELLS.softclipBasePositions.slice(index, index + 1),
    softclipBaseYs: CELLS.softclipBaseYs.slice(index, index + 1),
    softclipBaseBases: CELLS.softclipBaseBases.slice(index, index + 1),
  }
}

function drawnCell(index: number, reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  drawSoftclipBases(
    ctx,
    oneCell(index),
    block(reversed),
    BP_LENGTH,
    BLOCK_WIDTH,
    state(),
  )
  return rects[0]!
}

function coordsAt(
  canvasX: number,
  row: number,
  reversed: boolean,
): CigarCoords {
  return {
    bpPerPx: BP_PER_PX,
    genomicPos: bpAtPxExact(canvasX, bounds(reversed)),
    basePos: bpAtPx(canvasX, bounds(reversed)),
    row,
    adjustedY: row * FEATURE_HEIGHT,
    yWithinRow: 1,
  }
}

// The read each cell belongs to, which is what the hit answers with.
const READ_OF = ['read-a', 'read-a', 'read-a', 'read-b']

describe.each([false, true])('reversed: %s', reversed => {
  test('every hit lands inside a cell the painter drew for that read', () => {
    const cells = CELLS.softclipBasePositions
      .keys()
      .map(i => drawnCell(i, reversed))
      .toArray()
    let hits = 0
    for (let row = 0; row < 2; row++) {
      for (let x = 0; x < BLOCK_WIDTH; x += 0.5) {
        const hit = hitTestSoftclipBase(
          resolvedBlock(reversed),
          coordsAt(x, row, reversed),
          FEATURE_HEIGHT,
        )
        if (hit) {
          hits++
          // The answer is a READ, so the containment is against every cell that
          // read owns on this row rather than against one index — and "at least
          // one" rather than "exactly one", because the seam fudge deliberately
          // overlaps abutting cells by half a pixel.
          const covering = cells.filter(
            (cell, i) =>
              READ_OF[i] === hit.id &&
              CELLS.softclipBaseYs[i] === row &&
              x >= cell.x &&
              x < cell.x + cell.w,
          )
          expect(covering.length).toBeGreaterThan(0)
        }
      }
    }
    // Four cells, 20px of base each, two samples per px. The seam fudge widens
    // the drawn cell without widening the base it answers for, so the count
    // follows the BASES rather than the ink.
    expect(hits).toBe(160)
  })

  test.each([0, 1, 2, 3])('cell %i answers its own read', index => {
    const cell = drawnCell(index, reversed)
    const hit = hitTestSoftclipBase(
      resolvedBlock(reversed),
      coordsAt(cell.x + cell.w / 2, CELLS.softclipBaseYs[index]!, reversed),
      FEATURE_HEIGHT,
    )
    expect(hit?.id).toBe(READ_OF[index])
  })
})

// The band guard is the pileup's question, not the mark's, and it stays outside
// `findMarkAt`: below the row's body the cursor is in the inter-row gap, where
// nothing is painted.
test('a cursor in the inter-row gap answers nothing', () => {
  const cell = drawnCell(0, false)
  expect(
    hitTestSoftclipBase(
      resolvedBlock(false),
      { ...coordsAt(cell.x + 1, 0, false), yWithinRow: FEATURE_HEIGHT + 1 },
      FEATURE_HEIGHT,
    ),
  ).toBeUndefined()
})
