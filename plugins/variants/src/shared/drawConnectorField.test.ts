import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import {
  connectorFieldAlpha,
  drawConnectorField,
} from './drawConnectorField.ts'

import type { ConnectorCoord } from './ConnectorLines.tsx'

function paths(coords: ConnectorCoord[], strokeWidth = 0.5) {
  const svg = new SvgCanvas()
  drawConnectorField(svg, coords, 20, strokeWidth, 'rgba(0,0,0,0.1)')
  return svg.getSerializedSvg().match(/<path[^>]*\/>/g) ?? []
}

// The regression this file exists for. Every line used to go into ONE stroked
// path, and a rasterizer composites a stroked path once: overlapping lines
// unioned instead of accumulating, so a pixel 200 lines deep came out the same
// grey as a pixel one line deep and a dense field drew as flat polygons with
// hard edges. Separate strokes are the only thing that makes density visible.
test('each connector is its own stroked path', () => {
  expect(
    paths([
      { mx: 10, gx: 30 },
      { mx: 20, gx: 30 },
      { mx: 30, gx: 30 },
    ]),
  ).toHaveLength(3)
})

test('a connector runs from its column center up to its genomic position', () => {
  expect(paths([{ mx: 10, gx: 30 }])[0]).toContain('d="M10,20L30,0"')
})

// A column center is (i + 0.5) * pitch, so most of these are 17-digit floats and
// at 10^4 lines that is megabytes of a vector export spent below a hundredth of
// a pixel.
test('coordinates are rounded to two decimals', () => {
  expect(paths([{ mx: 1 / 3, gx: 2 / 3 }])[0]).toContain('d="M0.33,20L0.67,0"')
})

test('the alpha is measured over the coords own extent, not the viewport', () => {
  const n = 100
  const narrow = Array.from({ length: n }, (_, i) => ({ mx: i / 10, gx: 10 }))
  const wide = Array.from({ length: n }, (_, i) => ({ mx: i * 10, gx: 1000 }))
  expect(connectorFieldAlpha(narrow, 0.5)).toBeLessThan(
    connectorFieldAlpha(wide, 0.5),
  )
})

test('an empty field asks for no strokes and a usable alpha', () => {
  expect(paths([])).toHaveLength(0)
  expect(connectorFieldAlpha([], 0.5)).toBe(0.4)
})
