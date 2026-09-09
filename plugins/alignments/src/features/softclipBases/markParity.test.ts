import { makeTestRenderState } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { backToFront } from '../pileupShape.ts'
import { SOFTCLIP_BASES_MARK } from './mark.ts'

import type { SoftclipBasesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Draw against hit test, on the layer whose whole reason to have a hit test is
// that something IS painted where `hitTestFeature` finds nothing: the clipped
// tail is outside the read's aligned extent, so if these cells stop agreeing
// with their test the run goes back to answering nothing — the state the test
// was added for, and one no cross-backend gate can see, since both backends
// paint the run identically either way.

const START = 1000
const END = 1010
const BLOCK_WIDTH = 200
const FEATURE_HEIGHT = 10

const CELLS: SoftclipBasesUploadData = {
  // A run of three on row 0 and one on row 1, so the sweep crosses a boundary
  // between abutting cells as well as the ends of the run.
  softclipBasePositions: new Uint32Array([1002, 1003, 1004, 1008]),
  softclipBaseYs: new Uint16Array([0, 0, 0, 1]),
  softclipBaseBases: new Uint8Array([65, 67, 71, 84]),
}

// The read each cell belongs to, which is what the hit chain answers with
// (`softclipBaseReadIndices`); the mark answers the cell.
const READ_OF = ['read-a', 'read-a', 'read-a', 'read-b']

const STATE = makeTestRenderState({
  showSoftClipping: true,
  featureHeight: FEATURE_HEIGHT,
  featureSpacing: 0,
  canvasHeight: 500,
})

function block(reversed: boolean): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
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
  SOFTCLIP_BASES_MARK.paintBlock(ctx, oneCell(index), block(reversed), STATE)
  return rects[0]!
}

function hitAt(canvasX: number, canvasY: number, reversed: boolean) {
  const i = SOFTCLIP_BASES_MARK.hitNearest!(
    CELLS,
    block(reversed),
    STATE,
    canvasX,
    canvasY,
    backToFront(0, CELLS.softclipBaseYs.length),
    Infinity,
  )?.index
  return i === undefined ? undefined : READ_OF[i]
}

describe.each([false, true])('reversed: %s', reversed => {
  test('every hit lands inside a cell the painter drew for that read', () => {
    const cells = CELLS.softclipBasePositions
      .keys()
      .map(i => drawnCell(i, reversed))
      .toArray()
    let hits = 0
    for (let row = 0; row < 2; row++) {
      for (let x = 0; x < BLOCK_WIDTH; x += 0.5) {
        const hit = hitAt(x, row * FEATURE_HEIGHT + 1, reversed)
        if (hit) {
          hits++
          // The answer is a READ, so the containment is against every cell that
          // read owns on this row rather than against one index — and "at least
          // one" rather than "exactly one", because the seam fudge deliberately
          // overlaps abutting cells by half a pixel.
          const covering = cells.filter(
            (cell, i) =>
              READ_OF[i] === hit &&
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
    const row = CELLS.softclipBaseYs[index]!
    expect(hitAt(cell.x + cell.w / 2, row * FEATURE_HEIGHT + 1, reversed)).toBe(
      READ_OF[index],
    )
  })
})

// Below the row's body the cursor is in the inter-row gap, where nothing is
// painted, and the shape's row scan declines it before asking any cell.
test('a cursor in the inter-row gap answers nothing', () => {
  const spaced = makeTestRenderState({ ...STATE, featureSpacing: 4 })
  const cell = drawnCell(0, false)
  expect(
    SOFTCLIP_BASES_MARK.hitNearest!(
      CELLS,
      block(false),
      spaced,
      cell.x + 1,
      FEATURE_HEIGHT + 1,
      backToFront(0, CELLS.softclipBaseYs.length),
      Infinity,
    ),
  ).toBeUndefined()
})
