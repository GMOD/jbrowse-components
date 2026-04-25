import { buildViewProjection } from '@jbrowse/core/util/bpProjection'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'

import type { ViewProjection } from '@jbrowse/core/util/bpProjection'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

function createMockCanvas() {
  const strokeCalls: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(() => strokeCalls.push('stroke')),
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, strokeCalls }
}

function makeProj(bpPerPx = 1, offsetPx = 0): ViewProjection {
  return buildViewProjection({
    bpPerPx,
    offsetPx,
    interRegionPaddingWidth: 2,
    minimumBlockWidth: 5,
    displayedRegions: [
      { assemblyName: 'a', refName: 'chr1', start: 0, end: 100000 },
    ],
  })
}

function makeGeometry(count: number) {
  const x1s = new Uint32Array(count)
  const y1s = new Uint32Array(count)
  const x2s = new Uint32Array(count)
  const y2s = new Uint32Array(count)
  const xRegionIdx = new Uint8Array(count)
  const yRegionIdx = new Uint8Array(count)
  // red, full alpha: R=0xFF in bits 0-7, A=0xFF in bits 24-31
  const colors = new Uint32Array(count).fill(0xff0000ff)
  for (let i = 0; i < count; i++) {
    x1s[i] = i * 10
    y1s[i] = i * 10
    x2s[i] = i * 10 + 5
    y2s[i] = i * 10 + 5
  }
  return {
    x1s,
    y1s,
    x2s,
    y2s,
    xRegionIdx,
    yRegionIdx,
    colors,
    instanceCount: count,
  }
}

const PROJ_1 = [{ displayKey: 0, projH: makeProj(), projV: makeProj() }] as const

describe('Canvas2DDotplotRenderer', () => {
  function renderState(
    lineWidth: number,
    trackProjections: readonly {
      displayKey: number
      projH: ViewProjection
      projV: ViewProjection
    }[],
  ) {
    return { lineWidth, trackProjections }
  }

  test('renders lines for uploaded geometry', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(3))
    renderer.render(renderState(2, PROJ_1))
    expect(strokeCalls.length).toBe(3)
  })

  test('does nothing with zero instances', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(0))
    renderer.render(renderState(2, PROJ_1))
    expect(strokeCalls.length).toBe(0)
  })

  test('does nothing without uploadGeometry', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.render(renderState(2, PROJ_1))
    expect(strokeCalls.length).toBe(0)
  })

  test('applies projection to coordinates', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    renderer.uploadGeometry(0, {
      x1s: new Uint32Array([100]),
      y1s: new Uint32Array([200]),
      x2s: new Uint32Array([150]),
      y2s: new Uint32Array([250]),
      xRegionIdx: new Uint8Array([0]),
      yRegionIdx: new Uint8Array([0]),
      colors: new Uint32Array([0xff0000ff]),
      instanceCount: 1,
    })

    // bpPerPx=2, offsetPx=10 → x1=100/2 - 10 = 40, height-y1 = 600 - (200/2 - 20) = 520
    const projH = makeProj(2, 10)
    const projV = makeProj(2, 20)
    renderer.render(
      renderState(1, [{ displayKey: 0, projH, projV }]),
    )

    expect(ctx.moveTo).toHaveBeenCalledWith(40, 520)
  })

  test('sets strokeStyle from color data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    renderer.uploadGeometry(0, {
      x1s: new Uint32Array([0]),
      y1s: new Uint32Array([0]),
      x2s: new Uint32Array([1]),
      y2s: new Uint32Array([1]),
      xRegionIdx: new Uint8Array([0]),
      yRegionIdx: new Uint8Array([0]),
      colors: new Uint32Array([0xccbf4080]),
      instanceCount: 1,
    })

    renderer.render(renderState(1, PROJ_1))
    expect(ctx.strokeStyle).toMatch(/^rgba\(128,64,191,0\.8/)
  })

  test('renders multiple tracks independently', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.uploadGeometry(1, makeGeometry(3))
    renderer.render(
      renderState(2, [
        { displayKey: 0, projH: makeProj(), projV: makeProj() },
        { displayKey: 1, projH: makeProj(), projV: makeProj() },
      ]),
    )
    expect(strokeCalls.length).toBe(5)
  })

  test('deleteGeometry removes a track', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.uploadGeometry(1, makeGeometry(3))
    renderer.deleteGeometry(0)
    renderer.render(
      renderState(2, [
        { displayKey: 0, projH: makeProj(), projV: makeProj() },
        { displayKey: 1, projH: makeProj(), projV: makeProj() },
      ]),
    )
    expect(strokeCalls.length).toBe(3)
  })

  test('resize sets canvas dimensions', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(400, 300)
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  test('resize is idempotent for same dimensions', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(400, 300)
    canvas.width = 999
    renderer.resize(400, 300)
    expect(canvas.width).toBe(999)
  })

  test('dispose clears data so render is a no-op', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.dispose()
    renderer.render(renderState(1, PROJ_1))
    expect(strokeCalls.length).toBe(0)
  })
})
