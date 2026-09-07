import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { sweepDrawAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'

import { HIDDEN_ROW } from '../../shared/constants.ts'
import { cellMark } from './cellMark.ts'
import * as shader from './shaders/variant.iface.generated.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'
import { VARIANT_MARKS } from './variantMarks.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const MARK = VARIANT_MARKS[0]!

function mkData(cells: {
  positions: number[]
  rows: number[]
  colors: number[]
  shapes: number[]
}): VariantUploadData {
  return {
    cellPositions: new Uint32Array(cells.positions),
    cellRowIndices: new Uint32Array(cells.rows),
    cellColors: new Uint32Array(cells.colors),
    cellShapeTypes: new Uint8Array(cells.shapes),
    numCells: cells.rows.length,
  }
}

function makeBlock(
  overrides?: Partial<VariantRenderBlock>,
): VariantRenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...overrides,
  }
}

const STATE: VariantRenderState = {
  canvasWidth: 800,
  canvasHeight: 600,
  rowHeight: 10,
  scrollTop: 0,
}

function createMockCtx() {
  const fillRectCalls: [number, number, number, number][] = []
  const pathOps: string[] = []
  const ctx = {
    save: jest.fn(),
    restore: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    fillRect: jest.fn((...args: [number, number, number, number]) =>
      fillRectCalls.push(args),
    ),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    moveTo: jest.fn((...args: number[]) => pathOps.push(`moveTo(${args})`)),
    lineTo: jest.fn((...args: number[]) => pathOps.push(`lineTo(${args})`)),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
    arc: jest.fn(),
    fillStyle: '',
  }
  return { ctx: ctx as unknown as MarkContext2D, fillRectCalls, pathOps }
}

function paint(
  data: VariantUploadData,
  block = makeBlock(),
  state: VariantRenderState = STATE,
) {
  const mock = createMockCtx()
  paintMarkBlocks(mock.ctx, VARIANT_MARKS, new Map([[0, data]]), [block], state)
  return mock
}

// The declaration's own claim: which of this display's arrays reach which of
// the shape's lanes. A lane swap here packs a valid buffer that draws the wrong
// picture, which no shader-side test can see.
test('the declaration feeds positions/rows/shapes/colors to startEnd/rowIndex/shapeType/color', () => {
  const buf = MARK.pass.pack(
    mkData({
      positions: [100, 200, 300, 400],
      rows: [0, 1],
      colors: [0xff0000ff, 0x8000ff00],
      shapes: [0, 1],
    }),
  )
  const u32 = new Uint32Array(buf as ArrayBuffer)
  const stride = shader.INSTANCE_STRIDE_WORDS
  expect(buf.byteLength).toBe(2 * shader.INSTANCE_STRIDE_BYTES)

  expect(u32[shader.INSTANCE_OFFSET_U32.startEnd]).toBe(100)
  expect(u32[shader.INSTANCE_OFFSET_U32.startEnd + 1]).toBe(200)
  expect(u32[shader.INSTANCE_OFFSET_U32.rowIndex]).toBe(0)
  expect(u32[shader.INSTANCE_OFFSET_U32.shapeType]).toBe(0)
  expect(u32[shader.INSTANCE_OFFSET_U32.color]).toBe(0xff0000ff)

  expect(u32[stride + shader.INSTANCE_OFFSET_U32.startEnd]).toBe(300)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.startEnd + 1]).toBe(400)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.rowIndex]).toBe(1)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.shapeType]).toBe(1)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.color]).toBe(0x8000ff00)
})

describe('uniforms', () => {
  function uniformsFor(block: VariantRenderBlock, state = STATE) {
    const hal = new MockHal([MARK.pass])
    const scratch = new ArrayBuffer(MARK.pass.uniformByteSize)
    const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
      x: 1,
      y: 1,
    })!
    MARK.drawRegion(
      hal,
      scratch,
      block,
      clip,
      mkData({ positions: [100, 200], rows: [0], colors: [0], shapes: [0] }),
      state,
      block.displayedRegionIndex,
    )
    return hal.getLastUniformsF32()!
  }

  test('carries the frame and the params', () => {
    const f32 = uniformsFor(makeBlock(), { ...STATE, scrollTop: 50 })
    expect(f32[shader.UNIFORM_OFFSET_F32.canvasHeight]).toBe(600)
    expect(f32[shader.UNIFORM_OFFSET_F32.rowHeight]).toBe(10)
    expect(f32[shader.UNIFORM_OFFSET_F32.scrollTop]).toBe(50)
  })

  // The snap grid is anchored on the FULL canvas width so it matches every CPU
  // painter and hit test; the clipped block's span converts clip px.
  test('a clipped block keeps the full canvas width beside its own span', () => {
    const f32 = uniformsFor(makeBlock({ screenStartPx: 400, screenEndPx: 800 }))
    expect(f32[shader.UNIFORM_OFFSET_F32.canvasWidth]).toBe(800)
    expect(f32[shader.UNIFORM_OFFSET_F32.viewportWidth]).toBe(400)
  })

  test('a reversed block writes a negated bpRangeX length', () => {
    const forward = uniformsFor(makeBlock())
    const reversed = uniformsFor(makeBlock({ reversed: true }))
    expect(forward[shader.UNIFORM_OFFSET_F32.bpRangeX + 2]).toBeGreaterThan(0)
    expect(reversed[shader.UNIFORM_OFFSET_F32.bpRangeX + 2]).toBeLessThan(0)
  })
})

describe('painter', () => {
  const rect = (positions: number[], rows = [0], shapes = [0]) =>
    mkData({ positions, rows, colors: rows.map(() => 0xff0000ff), shapes })

  test('paints a rect cell with fillRect', () => {
    const { fillRectCalls } = paint(rect([100, 200]))
    expect(fillRectCalls).toEqual([[80, 0, 80, 10]])
  })

  // 0.8 px/bp, so bp 101..102 maps to x 80.8..81.6, a sub-pixel cell, which is
  // what every cell is at genome-wide zoom. The GPU path snaps these to whole
  // pixels; drawing at raw float x here put the SVG export half a pixel off the
  // on-screen render.
  test('pixel-snaps x, matching the shader', () => {
    const { fillRectCalls } = paint(rect([101, 102]))
    const [x, , w] = fillRectCalls[0]!
    expect(x).toBe(81)
    expect(w).toBe(2)
  })

  test('floors the painted height at 2px', () => {
    const { fillRectCalls } = paint(rect([100, 200]), makeBlock(), {
      ...STATE,
      rowHeight: 0.5,
    })
    expect(fillRectCalls[0]![3]).toBe(2)
  })

  test('culls rows scrolled above the canvas', () => {
    const { fillRectCalls } = paint(rect([0, 100]), makeBlock(), {
      ...STATE,
      scrollTop: 100,
    })
    expect(fillRectCalls).toHaveLength(0)
  })

  test('culls rows below the canvas', () => {
    const { fillRectCalls } = paint(rect([0, 100], [100]))
    expect(fillRectCalls).toHaveLength(0)
  })

  test('an inversion draws a left-pointing triangle', () => {
    const { pathOps } = paint(rect([0, 100], [0], [1]))
    expect(pathOps.find(op => op.startsWith('moveTo'))).toBe('moveTo(80,0)')
    expect(pathOps).toContain('lineTo(0,5)')
    expect(pathOps).toContain('lineTo(80,10)')
    expect(pathOps).toContain('fill')
  })

  // On a reversed block makeBpMapper mirrors bp→px, so the same cell lands on
  // the opposite side with its full span intact rather than as a sliver.
  test('a reversed block mirrors the cell to the opposite edge', () => {
    const { fillRectCalls } = paint(
      rect([100, 200]),
      makeBlock({ reversed: true }),
    )
    expect(fillRectCalls).toEqual([[640, 0, 80, 10]])
  })

  // The load-bearing half of HIDDEN_ROW: `placeVariantRows` sends a row the
  // display isn't drawing to a row index far below the canvas instead of
  // dropping the cell, on the strength of the painter culling by y.
  test('a cell placed at HIDDEN_ROW paints nothing', () => {
    const { fillRectCalls } = paint(
      mkData({
        positions: [100, 200, 100, 200],
        rows: [0, HIDDEN_ROW],
        colors: [0xff0000ff, 0xff00ff00],
        shapes: [0, 0],
      }),
    )
    expect(fillRectCalls).toHaveLength(1)
    expect(fillRectCalls[0]![1]).toBe(0)
  })
})

// Two overlapping cells on row 0, an inversion among them, a sub-pixel cell at
// the 2px floor and a cell on a later row, walked in both orientations and
// again at half-pixel rows, where the floor overlaps rows and the last-painted
// one has to answer. The inversion answers as its bounding box.
describe('draw against hit', () => {
  const cells = {
    startEnd: Uint32Array.of(100, 200, 150, 250, 101, 102, 300, 400),
    rowIndex: Uint32Array.of(0, 0, 1, 2),
    color: Uint32Array.of(0xff0000ff, 0xff00ff00, 0xffff0000, 0xff0000ff),
    shapeType: Uint8Array.of(0, 1, 0, 0),
    count: 4,
  }
  const frame = { canvasWidth: 800, canvasHeight: 600 }
  for (const rowHeight of [10, 0.5]) {
    for (const reversed of [false, true]) {
      for (const maxDistSq of [Number.MIN_VALUE, HIT_TOLERANCE_PX ** 2]) {
        test(`rowHeight ${rowHeight}, reversed ${reversed}, bound ${maxDistSq}`, () => {
          expect(
            sweepDrawAgainstHit(
              cellMark,
              cells,
              makeBlock({ reversed }),
              frame,
              { rowHeight, scrollTop: 0 },
              { maxDistSq },
            ),
          ).toEqual([])
        })
      }
    }
  }
})
