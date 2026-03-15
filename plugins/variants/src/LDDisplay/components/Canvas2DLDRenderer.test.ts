import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

const COS45 = 0.7071067811865476

function createMockCanvas() {
  const fillRectCalls: [number, number, number, number][] = []
  const pathOps: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn((...args: [number, number, number, number]) =>
      fillRectCalls.push(args),
    ),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    moveTo: jest.fn((...args) => pathOps.push(`moveTo(${args})`)),
    lineTo: jest.fn((...args) => pathOps.push(`lineTo(${args})`)),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
    rect: jest.fn(),
    clip: jest.fn(),
    strokeRect: jest.fn(),
    stroke: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, fillRectCalls, pathOps }
}

function makeColorRamp() {
  // 256 entries, 4 bytes each = 1024 bytes
  // Simple grayscale ramp: index i -> rgba(i, i, i, 255)
  const ramp = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    ramp[i * 4] = i
    ramp[i * 4 + 1] = i
    ramp[i * 4 + 2] = i
    ramp[i * 4 + 3] = 255
  }
  return ramp
}

function makeRenderState(
  overrides?: Partial<{
    canvasWidth: number
    canvasHeight: number
    yScalar: number
    signedLD: boolean
    viewScale: number
    viewOffsetX: number
  }>,
) {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    yScalar: 1,
    signedLD: false,
    viewScale: 1,
    viewOffsetX: 0,
    ...overrides,
  }
}

describe('Canvas2DLDRenderer', () => {
  describe('uploadData and uploadColorRamp', () => {
    test('stores data for rendering', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      renderer.uploadData({
        positions: new Float32Array([10, 20]),
        cellSizes: new Float32Array([5, 5]),
        ldValues: new Float32Array([0.5]),
        numCells: 1,
      })
      renderer.uploadColorRamp(makeColorRamp())

      renderer.render(makeRenderState())

      // Should have drawn a diamond (beginPath, moveTo, 3x lineTo, closePath, fill)
      expect(pathOps).toContain('beginPath')
      expect(pathOps).toContain('closePath')
      expect(pathOps).toContain('fill')
    })
  })

  describe('render', () => {
    test('does nothing with empty data', () => {
      const { canvas, pathOps, ctx } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      renderer.render(makeRenderState())

      expect(pathOps.length).toBe(0)
      expect(ctx.clearRect).toHaveBeenCalled()
    })

    test('does nothing without color ramp', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      renderer.uploadData({
        positions: new Float32Array([10, 20]),
        cellSizes: new Float32Array([5, 5]),
        ldValues: new Float32Array([0.5]),
        numCells: 1,
      })

      renderer.render(makeRenderState())

      expect(pathOps.length).toBe(0)
    })

    test('produces correct diamond rotated coordinates', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      const px = 10
      const py = 20
      const cw = 5
      const ch = 5

      renderer.uploadData({
        positions: new Float32Array([px, py]),
        cellSizes: new Float32Array([cw, ch]),
        ldValues: new Float32Array([1.0]),
        numCells: 1,
      })
      renderer.uploadColorRamp(makeColorRamp())

      const state = makeRenderState({
        viewScale: 1,
        viewOffsetX: 0,
        yScalar: 1,
      })
      renderer.render(state)

      // Verify the four corners are rotated by 45 degrees
      // corner0 = (px, py) = (10, 20)
      // corner1 = (px+cw, py) = (15, 20)
      // corner2 = (px+cw, py+ch) = (15, 25)
      // corner3 = (px, py+ch) = (10, 25)
      //
      // Rotated: rx = (cx+cy)*COS45, ry = (-cx+cy)*COS45
      // Then: sx = rx * viewScale + viewOffsetX, sy = ry * viewScale * yScalar
      const corners = [
        [px, py],
        [px + cw, py],
        [px + cw, py + ch],
        [px, py + ch],
      ]
      const expected = corners.map(([cx, cy]) => {
        const rx = (cx! + cy!) * COS45
        const ry = (-cx! + cy!) * COS45
        return [rx * 1 + 0, ry * 1 * 1]
      })

      expect(ctx.moveTo).toHaveBeenCalledWith(
        expect.closeTo(expected[0]![0]!, 5),
        expect.closeTo(expected[0]![1]!, 5),
      )
      expect(ctx.lineTo).toHaveBeenCalledTimes(3)
      expect(ctx.lineTo).toHaveBeenNthCalledWith(
        1,
        expect.closeTo(expected[1]![0]!, 5),
        expect.closeTo(expected[1]![1]!, 5),
      )
      expect(ctx.lineTo).toHaveBeenNthCalledWith(
        2,
        expect.closeTo(expected[2]![0]!, 5),
        expect.closeTo(expected[2]![1]!, 5),
      )
      expect(ctx.lineTo).toHaveBeenNthCalledWith(
        3,
        expect.closeTo(expected[3]![0]!, 5),
        expect.closeTo(expected[3]![1]!, 5),
      )
    })

    test('signedLD mode maps -1..1 to 0..1 for ramp lookup', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      // ldValue = -1 in signed mode should map to t=0, rampIdx=0
      renderer.uploadData({
        positions: new Float32Array([0, 0]),
        cellSizes: new Float32Array([1, 1]),
        ldValues: new Float32Array([-1]),
        numCells: 1,
      })
      renderer.uploadColorRamp(makeColorRamp())

      renderer.render(makeRenderState({ signedLD: true }))

      // t = (-1 + 1) / 2 = 0, rampIdx = 0*4 = 0
      // color = rgba(0, 0, 0, 255/255) = rgba(0,0,0,1)
      expect(ctx.fillStyle).toBe('rgba(0,0,0,1)')
    })

    test('signedLD maps 1 to ramp end', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      renderer.uploadData({
        positions: new Float32Array([0, 0]),
        cellSizes: new Float32Array([1, 1]),
        ldValues: new Float32Array([1]),
        numCells: 1,
      })
      renderer.uploadColorRamp(makeColorRamp())

      renderer.render(makeRenderState({ signedLD: true }))

      // t = (1 + 1) / 2 = 1, rampIdx = 255*4 = 1020
      // color = rgba(255, 255, 255, 1)
      expect(ctx.fillStyle).toBe('rgba(255,255,255,1)')
    })

    test('unsigned mode uses ldValue directly as ramp position', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      renderer.uploadData({
        positions: new Float32Array([0, 0]),
        cellSizes: new Float32Array([1, 1]),
        ldValues: new Float32Array([0.5]),
        numCells: 1,
      })
      renderer.uploadColorRamp(makeColorRamp())

      renderer.render(makeRenderState({ signedLD: false }))

      // t = 0.5, rampIdx = round(0.5*255)*4 = 128*4 = 512
      // color = rgba(128, 128, 128, 1)
      expect(ctx.fillStyle).toBe('rgba(128,128,128,1)')
    })

    test('skips cells with near-zero alpha', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      // Make a ramp where index 0 has alpha=0
      const ramp = makeColorRamp()
      ramp[3] = 0 // first entry alpha = 0

      renderer.uploadData({
        positions: new Float32Array([0, 0]),
        cellSizes: new Float32Array([1, 1]),
        ldValues: new Float32Array([0]),
        numCells: 1,
      })
      renderer.uploadColorRamp(ramp)

      renderer.render(makeRenderState({ signedLD: false }))

      // alpha = 0/255 = 0 < 0.01, so cell is skipped
      expect(pathOps).not.toContain('fill')
    })
  })

  describe('destroy', () => {
    test('clears stored data', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DLDRenderer(canvas)

      renderer.uploadData({
        positions: new Float32Array([0, 0]),
        cellSizes: new Float32Array([1, 1]),
        ldValues: new Float32Array([0.5]),
        numCells: 1,
      })
      renderer.uploadColorRamp(makeColorRamp())

      renderer.destroy()

      renderer.render(makeRenderState())
      expect(pathOps.length).toBe(0)
    })
  })
})
