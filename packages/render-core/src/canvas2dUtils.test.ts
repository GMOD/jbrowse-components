import {
  MAX_CANVAS_DIM_PX,
  devicePxSpan,
  getPreparedCanvas2D,
  makeBpMapper,
  makeCellLeftMapper,
  syncCanvasSize,
} from './canvas2dUtils.ts'

import type { BpRegionBounds } from './renderBlock.ts'

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

// The pivot every Canvas2D per-base cell painter needs. `makeBpMapper(bp)` is
// the cell's left edge only on a forward block; reversed, bp runs leftward so it
// lands on the cell's RIGHT edge and a rect filled rightward from it covers the
// wrong base. One base of error: invisible zoomed out, glaring zoomed in, and
// only on flipped regions.
describe('makeCellLeftMapper', () => {
  // bp 100..110 across [0,100] => 10 px/bp. bp 100 owns [0,10] forward; it's the
  // rightmost base reversed, owning [90,100].
  const span: BpRegionBounds = {
    start: 100,
    end: 110,
    screenStartPx: 0,
    screenEndPx: 100,
  }

  test('forward: identical to makeBpMapper (no shift)', () => {
    const cellLeft = makeCellLeftMapper(span)
    const bpToPx = makeBpMapper(span)
    for (const bp of [100, 105, 109]) {
      expect(cellLeft(bp)).toBeCloseTo(bpToPx(bp))
    }
  })

  test('forward: left edge of the base cell', () => {
    const cellLeft = makeCellLeftMapper(span)
    expect(cellLeft(100)).toBeCloseTo(0)
    expect(cellLeft(105)).toBeCloseTo(50)
  })

  test('reversed: left edge of that same base, one cell left of makeBpMapper', () => {
    const rev = { ...span, reversed: true }
    const cellLeft = makeCellLeftMapper(rev)
    const bpToPx = makeBpMapper(rev)
    // bp 100 spans [90,100]: makeBpMapper gives its right edge (100).
    expect(bpToPx(100)).toBeCloseTo(100)
    expect(cellLeft(100)).toBeCloseTo(90)
    expect(cellLeft(105)).toBeCloseTo(40)
  })

  test('cells tile without gap or overlap in both orientations', () => {
    for (const reversed of [false, true]) {
      const cellLeft = makeCellLeftMapper({ ...span, reversed })
      const pxPerBp = 10
      for (let bp = 100; bp < 109; bp++) {
        const here = cellLeft(bp)
        const next = cellLeft(bp + 1)
        // Neighboring cells sit exactly one cell apart, sign set by orientation.
        expect(Math.abs(next - here)).toBeCloseTo(pxPerBp)
      }
    }
  })

  test('honors screenStartPx offset and fractional zoom', () => {
    // 10bp across 5px => 0.5 px/bp, offset by 20.
    const tiny = { start: 100, end: 110, screenStartPx: 20, screenEndPx: 25 }
    expect(makeCellLeftMapper(tiny)(100)).toBeCloseTo(20)
    expect(makeCellLeftMapper({ ...tiny, reversed: true })(100)).toBeCloseTo(
      24.5,
    )
  })
})
