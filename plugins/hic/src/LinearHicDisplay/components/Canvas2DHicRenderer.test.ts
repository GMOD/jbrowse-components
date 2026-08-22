import { packTestInstances } from '../../testInstances.ts'
import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

function createMockCanvas() {
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    fillRect: jest.fn(),
    fillStyle: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx }
}

function makeColorRamp() {
  const ramp = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    ramp[i * 4] = i
    ramp[i * 4 + 1] = i
    ramp[i * 4 + 2] = i
    ramp[i * 4 + 3] = 255
  }
  return ramp
}

// Fixtures name positions and counts separately because that is how they read;
// the payload is the packed instance layout, so `packTestInstances` is the one
// place that knows the interleave. `numContacts` follows `counts` rather than
// being restated at each call.
function makeData({
  positions = [10, 20],
  counts = [50],
  ...overrides
}: {
  positions?: number[]
  counts?: number[]
} & Partial<Omit<HicUploadData, 'instances'>> = {}): HicUploadData {
  return {
    instances: packTestInstances(positions, counts),
    numContacts: counts.length,
    binWidth: 10,
    ...overrides,
  }
}

function makeRenderState(overrides?: Partial<HicRenderState>): HicRenderState {
  return {
    yScalar: 1,
    canvasWidth: 800,
    canvasHeight: 600,
    colorMaxScore: 100,
    useLogScale: false,
    viewScale: 1,
    viewOffsetX: 0,
    ...overrides,
  }
}

describe('Canvas2DHicRenderer', () => {
  test('renders fillRects for uploaded contacts', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(makeData(), makeRenderState())

    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 10, 10)
  })

  test('applies yScalar via the ctx stack and viewScale on the coordinates', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeData({ positions: [10, 20] }),
      makeRenderState({ viewScale: 2, viewOffsetX: 100, yScalar: 0.5 }),
    )

    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.translate).toHaveBeenCalledWith(100, 0)
    expect(ctx.scale).toHaveBeenCalledWith(1, 0.5)
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 4)
    expect(ctx.fillRect).toHaveBeenCalledWith(20, 40, 20, 20)
    expect(ctx.restore).toHaveBeenCalled()
  })

  test('does nothing with null data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.render(null, makeRenderState())

    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  test('does nothing without color ramp', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.render(makeData(), makeRenderState())

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  test('skips cells with near-zero alpha', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    const ramp = makeColorRamp()
    ramp[3] = 0
    renderer.uploadColorRamp(ramp)

    renderer.render(
      makeData({
        positions: [0, 0],
        counts: [0],
      }),
      makeRenderState(),
    )

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  test('renders multiple contacts', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeData({
        positions: [0, 0, 10, 10, 20, 20],
        counts: [50, 75, 90],
      }),
      makeRenderState(),
    )

    expect(ctx.fillRect).toHaveBeenCalledTimes(3)
  })

  // Canvas2D pays a full fillRect per contact, and a panned viewport redraws a
  // matrix that partly sits off-screen (pan is a redraw over the buffered
  // static-block fetch), so the draw loop culls on the rotated x axis.
  // A cull that eats a visible bin is worse than no cull, hence the edge cases.
  describe('off-screen culling', () => {
    // screen x of a cell's apex-ward corner is `((px+py)/√2)*viewScale + off`
    const screenX = (px: number, py: number) => ((px + py) / Math.SQRT2) * 1
    const W = 10

    function drawnAt(px: number, py: number, canvasWidth: number) {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DHicRenderer(canvas)
      renderer.uploadColorRamp(makeColorRamp())
      renderer.render(
        makeData({ positions: [px, py], binWidth: W }),
        makeRenderState({ canvasWidth }),
      )
      return ctx.fillRect.mock.calls.length === 1
    }

    test('drops a cell entirely right of the canvas', () => {
      // apex corner well past the right edge of an 800px canvas
      expect(screenX(1200, 1200)).toBeGreaterThan(800)
      expect(drawnAt(1200, 1200, 800)).toBe(false)
    })

    test('drops a cell entirely left of the canvas', () => {
      expect(drawnAt(-500, -500, 800)).toBe(false)
    })

    test('keeps a cell straddling the left edge', () => {
      // apex corner is off-screen left, but the cell's far corner
      // (px+W, py+W) — 2*binWidth further along the sum axis — is on-screen
      const px = -W / 2
      expect(screenX(px, px)).toBeLessThan(0)
      expect(screenX(px + W, px + W)).toBeGreaterThan(0)
      expect(drawnAt(px, px, 800)).toBe(true)
    })

    test('keeps a cell straddling the right edge', () => {
      // apex corner just inside the right edge, far corner past it
      const px = (800 * Math.SQRT2 - 5) / 2
      expect(screenX(px, px)).toBeLessThan(800)
      expect(screenX(px + W, px + W)).toBeGreaterThan(800)
      expect(drawnAt(px, px, 800)).toBe(true)
    })

    test('keeps everything on a canvas wide enough for the whole matrix', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DHicRenderer(canvas)
      renderer.uploadColorRamp(makeColorRamp())
      renderer.render(
        makeData({
          positions: [0, 0, 10, 10, 20, 20],
          counts: [50, 75, 90],
        }),
        makeRenderState({ canvasWidth: 800 }),
      )
      expect(ctx.fillRect).toHaveBeenCalledTimes(3)
    })
  })

  test('useLogScale affects color mapping', () => {
    const { canvas, ctx } = createMockCanvas()

    const linearRenderer = new Canvas2DHicRenderer(canvas)
    linearRenderer.uploadColorRamp(makeColorRamp())
    linearRenderer.render(
      makeData({ positions: [0, 0] }),
      makeRenderState({ useLogScale: false }),
    )
    const linearColor = ctx.fillStyle

    const logRenderer = new Canvas2DHicRenderer(canvas)
    logRenderer.uploadColorRamp(makeColorRamp())
    logRenderer.render(
      makeData({ positions: [0, 0] }),
      makeRenderState({ useLogScale: true }),
    )
    const logColor = ctx.fillStyle

    expect(linearColor).not.toBe(logColor)
  })
})

// The Canvas2D twin of the GPU renderer's paint reporting, and it has a case the
// GPU one does not: this backend draws nothing until `uploadColorRamp` has run,
// because it has no palette to fill with. The display's model could not see that
// — it answered from `rpcData` alone — so the frame between the fetch landing
// and the ramp arriving reported drawn over a blank canvas.
describe('Canvas2DHicRenderer paint reporting', () => {
  test('false before the colour ramp arrives, true after', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    const data = makeData()

    expect(renderer.render(data, makeRenderState())).toBe(false)

    renderer.uploadColorRamp(makeColorRamp())
    expect(renderer.render(data, makeRenderState())).toBe(true)
  })

  test('false with no payload', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    expect(renderer.render(null, makeRenderState())).toBe(false)
  })

  test('prepares the canvas either way, so a stale picture cannot survive', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.render(null, makeRenderState())

    expect(ctx.clearRect).toHaveBeenCalled()
  })
})
