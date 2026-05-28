import { getPreparedCanvas2D } from './canvas2dUtils.ts'

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
