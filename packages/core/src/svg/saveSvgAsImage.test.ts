import { MAX_SVG_RASTER_AREA_PX } from '../util/createSvgRasterCanvas.ts'
import { pngRasterScale } from './saveSvgAsImage.ts'

test('a figure that fits the canvas limits rasterizes at the scale asked for', () => {
  expect(pngRasterScale(1200, 3000, 2)).toBe(2)
})

test('a very tall figure drops resolution to fit the per-axis limit instead of failing', () => {
  const scale = pngRasterScale(1200, 20_000, 2)
  expect(scale).toBeLessThan(2)
  expect(scale).toBeGreaterThanOrEqual(1)
  expect(20_000 * scale).toBeLessThanOrEqual(32767)
})

test('a large figure drops resolution to fit the area limit', () => {
  const scale = pngRasterScale(12_000, 12_000, 2)
  expect(scale).toBeGreaterThanOrEqual(1)
  expect(12_000 * scale * 12_000 * scale).toBeLessThanOrEqual(
    MAX_SVG_RASTER_AREA_PX * 1.000001,
  )
})

test('a figure past the limits even at screen resolution gets a scale below 1', () => {
  expect(pngRasterScale(1200, 40_000, 2)).toBeLessThan(1)
})
