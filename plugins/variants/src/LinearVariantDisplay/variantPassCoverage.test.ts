import { deriveSampleCount } from '@jbrowse/render-core/createRenderingBackend'

import { cellMark } from './components/cellMark.ts'
import * as cellGlsl from './components/shaders/variant.glsl.generated.ts'
import * as cellWgsl from './components/shaders/variant.wgsl.generated.ts'
import { matrixCellMark } from './matrix/matrixCellMark.ts'
import * as matrixGlsl from './matrix/shaders/variantMatrix.glsl.generated.ts'
import * as matrixWgsl from './matrix/shaders/variantMatrix.wgsl.generated.ts'

// Rows snapped to the device grid at one sample show one row per pixel in a
// cohort taller than the canvas, a different row after every resize, so rows
// blinked as the track height changed.
test.each([
  ['cell', cellMark],
  ['matrixCell', matrixCellMark],
])('%s draws on the four-sample target', (_, mark) => {
  expect(deriveSampleCount([mark.pass])).toBe(4)
})

test.each([
  ['cell', cellWgsl.WGSL_SOURCE, cellGlsl.GLSL_VERTEX],
  ['matrixCell', matrixWgsl.WGSL_SOURCE, matrixGlsl.GLSL_VERTEX],
])('%s places its rows at fractional y on every backend', (_, wgsl, glsl) => {
  for (const src of [wgsl, glsl]) {
    expect(src).not.toContain('snappedRowTopPx')
  }
})
