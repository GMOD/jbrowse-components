import {
  MAX_CANVAS_DIM_PX,
  devicePxSpan,
  getPreparedCanvas2D,
  syncCanvasSize,
} from './canvas2dUtils.ts'

function makeFakeCanvas(ctx: unknown) {
  const calls = { setTransform: 0, clearRect: 0 }
  const fakeCtx = {
    setTransform() {
      calls.setTransform++
    },
    clearRect() {
      calls.clearRect++
    },
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (ctx === undefined ? fakeCtx : ctx),
  }
  return { canvas, fakeCtx, calls }
}

test('returns null when the canvas ref is null', () => {
  expect(getPreparedCanvas2D(null, 100, 20)).toBeNull()
})

test('returns null when getContext yields null', () => {
  const { canvas } = makeFakeCanvas(null)
  expect(
    getPreparedCanvas2D(canvas as unknown as HTMLCanvasElement, 100, 20),
  ).toBeNull()
})

test('returns the prepared context and applies the DPR backing-store sizing', () => {
  const { canvas, fakeCtx, calls } = makeFakeCanvas(undefined)
  const ctx = getPreparedCanvas2D(
    canvas as unknown as HTMLCanvasElement,
    100,
    20,
  )
  expect(ctx).toBe(fakeCtx)
  // prepareCanvas ran: backing store sized to CSS * dpr (dpr=1 in jsdom) and
  // the transform/clear were applied.
  expect(canvas.width).toBe(100)
  expect(canvas.height).toBe(20)
  expect(calls.setTransform).toBe(1)
  expect(calls.clearRect).toBe(1)
})

test('devicePxSpan edge-rounds so the right edge never exceeds round(cssEnd*dpr)', () => {
  // width-rounding round(3*1.5)=5 gives right edge 1496+5=1501; edge-rounding
  // pins it to round(1000*1.5)=1500.
  expect(devicePxSpan(997, 1000, 1.5)).toEqual({ start: 1496, width: 4 })
})

test('devicePxSpan produces abutting spans with no seam or overlap', () => {
  const dpr = 1.5
  for (let b = 100; b < 140; b++) {
    const left = devicePxSpan(b - 1, b, dpr)
    const right = devicePxSpan(b, b + 1, dpr)
    expect(left.start + left.width).toBe(right.start)
  }
})

test('clamps an oversized backing store to the safe max instead of throwing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const canvas = {
    width: 0,
    height: 0,
    style: {} as { width?: string; height?: string },
  }
  syncCanvasSize(
    canvas as unknown as HTMLCanvasElement,
    1000,
    MAX_CANVAS_DIM_PX + 5000,
  )
  // backing store capped to the limit, but CSS size stays the requested value
  expect(canvas.height).toBe(MAX_CANVAS_DIM_PX)
  expect(canvas.width).toBe(1000)
  expect(canvas.style.height).toBe(`${MAX_CANVAS_DIM_PX + 5000}px`)
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})
