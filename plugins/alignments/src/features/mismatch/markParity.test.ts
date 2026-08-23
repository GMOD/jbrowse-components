import { bpAtPx, bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import { drawMismatches } from './drawCanvas.ts'
import { hitTestMismatch } from './hitTest.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { MismatchUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draw against hit test for the `cell` shape, which is where the two are easiest
// to pair wrong: the painter floors one-sidedly into a base's own cell and the
// hit test contains the INTEGER `basePos`, and substituting the fractional
// `genomicPos` names the neighbouring base on a reversed block — silently, on
// exactly one pixel column per base. `cellPainterParity.test.ts` pins the five
// painters to that floor; nothing pinned the hit test to it.

const START = 1000
const END = 1010
const BP_LENGTH = END - START
const BLOCK_WIDTH = 200
// 20 px/bp, so a one-base error is 20px rather than a rounding tolerance.
const BP_PER_PX = BP_LENGTH / BLOCK_WIDTH
const FEATURE_HEIGHT = 10

const MISMATCHES: MismatchUploadData = {
  mismatchPositions: new Uint32Array([1002, 1005, 1006]),
  mismatchYs: new Uint16Array([0, 0, 1]),
  mismatchBases: new Uint8Array([65, 67, 71]),
  mismatchFrequencies: new Uint8Array([255, 255, 255]),
  mismatchQuals: new Uint8Array([60, 60, 60]),
}

const rgb = (r: number, g: number, b: number): [number, number, number] => [
  r,
  g,
  b,
]

function state(): RenderState {
  return {
    featureHeight: FEATURE_HEIGHT,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    canvasHeight: 500,
    mismatchAlpha: false,
    filterMismatchesByFrequency: true,
    colors: {
      colorBaseA: rgb(0, 1, 0),
      colorBaseC: rgb(0, 0, 1),
      colorBaseG: rgb(1, 0.65, 0),
      colorBaseT: rgb(1, 0, 0),
      colorBaseN: rgb(0.4, 0.3, 0.2),
      colorMutedSnpBase: rgb(0.5, 0.5, 0.5),
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
    rpcData: MISMATCHES as PileupDataResult,
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

function oneMismatch(index: number): MismatchUploadData {
  return {
    mismatchPositions: MISMATCHES.mismatchPositions.slice(index, index + 1),
    mismatchYs: MISMATCHES.mismatchYs.slice(index, index + 1),
    mismatchBases: MISMATCHES.mismatchBases.slice(index, index + 1),
    mismatchFrequencies: MISMATCHES.mismatchFrequencies.slice(index, index + 1),
    mismatchQuals: MISMATCHES.mismatchQuals.slice(index, index + 1),
  }
}

function drawnCell(index: number, reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  drawMismatches(
    ctx,
    oneMismatch(index),
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

describe.each([false, true])('reversed: %s', reversed => {
  test('every hit lands inside the cell the painter drew', () => {
    let hits = 0
    for (let row = 0; row < 2; row++) {
      for (let x = 0; x < BLOCK_WIDTH; x += 0.5) {
        const hit = hitTestMismatch(
          resolvedBlock(reversed),
          coordsAt(x, row, reversed),
          true,
        )
        if (hit) {
          hits++
          const cell = drawnCell(hit.index, reversed)
          expect(x).toBeGreaterThanOrEqual(cell.x)
          expect(x).toBeLessThan(cell.x + cell.w)
        }
      }
    }
    // Three marks over two rows, 20px of cell each: a sweep that resolved none
    // of them would pass the containment vacuously.
    expect(hits).toBe(120)
  })

  test.each([0, 1, 2])('cell %i answers at its own middle', index => {
    const cell = drawnCell(index, reversed)
    const hit = hitTestMismatch(
      resolvedBlock(reversed),
      coordsAt(cell.x + cell.w / 2, MISMATCHES.mismatchYs[index]!, reversed),
      true,
    )
    expect(hit?.index).toBe(index)
  })
})
