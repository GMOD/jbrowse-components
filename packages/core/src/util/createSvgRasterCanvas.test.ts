import {
  MAX_SVG_RASTER_AREA_PX,
  createSvgRasterCanvas,
  svgRasterDataUrl,
} from './createSvgRasterCanvas.ts'

function fakeCanvas(dataUrl = 'data:image/png;base64,AAAA') {
  const scale = jest.fn()
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ scale }),
    toDataURL: () => dataUrl,
  } as unknown as HTMLCanvasElement
  return { canvas, scale }
}

function raster(width: number, height: number, maxAreaPx?: number) {
  const fake = fakeCanvas()
  createSvgRasterCanvas(
    width,
    height,
    { createCanvas: () => fake.canvas },
    maxAreaPx,
  )
  return fake
}

test('an ordinary layer rasterizes at 2x', () => {
  const { canvas, scale } = raster(1266, 300)
  expect([canvas.width, canvas.height]).toEqual([2532, 600])
  expect(scale).toHaveBeenCalledWith(2, 2)
})

// Past 2^28 px Chrome hands back a context that draws nothing and encodes to
// `data:,`; a fully zoomed circular view's figure is about 10,160 CSS px.
test('a layer past the area limit rasterizes whole at a lower scale', () => {
  const { canvas, scale } = raster(10160, 10160)
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(
    MAX_SVG_RASTER_AREA_PX,
  )
  const [sx, sy] = scale.mock.calls[0]!
  expect(sx).toBe(canvas.width / 10160)
  expect(sy).toBe(canvas.height / 10160)
  expect(sx).toBeLessThan(2)
})

// A 2,504-sample matrix expanded to its full height.
test('a tall layer stays inside every browser per-axis limit', () => {
  const { canvas } = raster(2560, 25040)
  expect(canvas.height).toBeLessThanOrEqual(32767)
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(
    MAX_SVG_RASTER_AREA_PX,
  )
})

test('a caller can ask for a smaller area budget', () => {
  const { canvas } = raster(10160, 10160, 8192 * 8192)
  expect(canvas.width).toBeLessThanOrEqual(8192)
})

test('a raster the browser could not allocate throws', () => {
  expect(() => svgRasterDataUrl(fakeCanvas('data:,').canvas)).toThrow(
    /export a smaller view/,
  )
})
