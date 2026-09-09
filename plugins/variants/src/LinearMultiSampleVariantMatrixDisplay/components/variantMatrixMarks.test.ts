import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import * as shader from './shaders/variantMatrix.iface.generated.ts'
import { VARIANT_MATRIX_MARKS } from './variantMatrixMarks.ts'

import type {
  MatrixRenderState,
  VariantMatrixRenderBlock,
  VariantMatrixUploadData,
} from './variantMatrixRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const MARK = VARIANT_MATRIX_MARKS[0]!

const STATE: MatrixRenderState = {
  canvasWidth: 400,
  canvasHeight: 300,
  rowHeight: 10,
  scrollTop: 0,
}

function makeData(
  overrides?: Partial<VariantMatrixUploadData>,
): VariantMatrixUploadData {
  return {
    cellFeatureIndices: new Float32Array([0]),
    cellRowIndices: new Uint32Array([0]),
    cellColors: new Uint32Array([0xff0000ff]),
    numCells: 1,
    numFeatures: 4,
    ...overrides,
  }
}

// The whole canvas, as the display's `matrixBlocks` builds it: the block
// carries the clip, and the payload's column count carries the pitch.
function block(
  data: VariantMatrixUploadData,
  state: MatrixRenderState,
): VariantMatrixRenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 0,
    end: data.numFeatures,
    screenStartPx: 0,
    screenEndPx: state.canvasWidth,
    reversed: false,
  }
}

function createMockCtx() {
  const fillRectCalls: [number, number, number, number][] = []
  const ctx = {
    save: jest.fn(),
    restore: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn((...args: [number, number, number, number]) =>
      fillRectCalls.push(args),
    ),
    fillStyle: '',
  }
  return { ctx: ctx as unknown as MarkContext2D, raw: ctx, fillRectCalls }
}

function paint(data: VariantMatrixUploadData, state = STATE) {
  const mock = createMockCtx()
  paintMarkBlocks(
    mock.ctx,
    VARIANT_MATRIX_MARKS,
    new Map([[0, data]]),
    [block(data, state)],
    state,
  )
  return mock
}

test('the declaration feeds indices/rows/colors to featureIndex/row/color', () => {
  const buf = MARK.pass.pack(
    makeData({
      cellFeatureIndices: new Float32Array([2, 3]),
      cellRowIndices: new Uint32Array([0, 7]),
      cellColors: new Uint32Array([0xff0000ff, 0x8000ff00]),
      numCells: 2,
    }),
  )
  const u32 = new Uint32Array(buf as ArrayBuffer)
  const f32 = new Float32Array(buf as ArrayBuffer)
  const stride = shader.INSTANCE_STRIDE_WORDS
  expect(buf.byteLength).toBe(2 * shader.INSTANCE_STRIDE_BYTES)

  expect(f32[shader.INSTANCE_OFFSET_F32.featureIndex]).toBe(2)
  expect(u32[shader.INSTANCE_OFFSET_U32.row]).toBe(0)
  expect(u32[shader.INSTANCE_OFFSET_U32.color]).toBe(0xff0000ff)
  expect(f32[stride + shader.INSTANCE_OFFSET_F32.featureIndex]).toBe(3)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.row]).toBe(7)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.color]).toBe(0x8000ff00)
})

// `numFeatures` is the payload's, not the frame's: the one uniform `params`
// reads off the region rather than the render state.
test('the uniforms carry the payload column count beside the frame', () => {
  const data = makeData({ numFeatures: 4 })
  const state = { ...STATE, scrollTop: 50 }
  const hal = new MockHal([MARK.pass])
  const scratch = new ArrayBuffer(MARK.pass.uniformByteSize)
  const b = block(data, state)
  const clip = clipBlock(b, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  MARK.drawRegion(hal, scratch, b, clip, data, state, b.displayedRegionIndex)
  const f32 = hal.getLastUniformsF32()!
  expect(f32[shader.UNIFORM_OFFSET_F32.numFeatures]).toBe(4)
  expect(f32[shader.UNIFORM_OFFSET_F32.canvasWidth]).toBe(400)
  expect(f32[shader.UNIFORM_OFFSET_F32.canvasHeight]).toBe(300)
  expect(f32[shader.UNIFORM_OFFSET_F32.rowHeight]).toBe(10)
  expect(f32[shader.UNIFORM_OFFSET_F32.scrollTop]).toBe(50)
})

describe('painter', () => {
  test('paints a rect per cell', () => {
    const { fillRectCalls } = paint(
      makeData({
        cellFeatureIndices: new Float32Array([0, 1]),
        cellRowIndices: new Uint32Array([0, 1]),
        cellColors: new Uint32Array([0xff0000ff, 0xff00ff00]),
        numCells: 2,
      }),
    )
    expect(fillRectCalls).toHaveLength(2)
  })

  // featureIndex 2 of 4 across width 400 => cellWidth 100, x = 200; the 0.3px
  // overdraw (f2) shifts each edge so sub-pixel columns antialias and blend.
  test('places a cell at its column with the seam overdraw', () => {
    const { fillRectCalls } = paint(
      makeData({
        cellFeatureIndices: new Float32Array([2]),
        cellRowIndices: new Uint32Array([3]),
        cellColors: new Uint32Array([0xff204080]),
      }),
      { ...STATE, canvasHeight: 600, rowHeight: 20 },
    )
    const [x, y, w, h] = fillRectCalls[0]!
    expect(x).toBeCloseTo(199.7)
    expect(y).toBeCloseTo(59.7)
    expect(w).toBeCloseTo(100.3)
    expect(h).toBeCloseTo(20.3)
  })

  // A sub-pixel row takes the shader's 1px floor and its exact anchor rather
  // than the seam overdraw, so a variant row survives among reference rows.
  test('a sub-pixel row paints the floored band without the overdraw', () => {
    const { fillRectCalls } = paint(makeData(), { ...STATE, rowHeight: 0.1 })
    const [, y, , h] = fillRectCalls[0]!
    expect(y).toBe(0)
    expect(h).toBe(1)
  })

  test('culls rows scrolled above the canvas', () => {
    const { fillRectCalls } = paint(makeData(), { ...STATE, scrollTop: 100 })
    expect(fillRectCalls).toHaveLength(0)
  })

  test('culls rows below the canvas', () => {
    const { fillRectCalls } = paint(
      makeData({ cellRowIndices: new Uint32Array([50]) }),
    )
    expect(fillRectCalls).toHaveLength(0)
  })

  test('paints nothing when numFeatures is 0', () => {
    const { fillRectCalls } = paint(makeData({ numFeatures: 0 }))
    expect(fillRectCalls).toHaveLength(0)
  })

  test('sets the fill from the packed colour', () => {
    const { raw } = paint(
      makeData({ cellColors: new Uint32Array([0x7f204080]) }),
    )
    expect(raw.fillStyle).toBe(`rgba(128,64,32,${127 / 255})`)
  })
})
