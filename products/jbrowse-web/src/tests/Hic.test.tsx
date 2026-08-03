import './svgExportMocks.ts'

import { fireEvent } from '@testing-library/react'

import hicConfig from '../../../../extra_test_data/hic_integration_test.json' with { type: 'json' }
import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  getSavedSvg,
  hts,
  setup,
} from './util.tsx'

import type { LinearHicDisplayModel } from '@jbrowse/plugin-hic'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach(url => require.resolve(`../../../../extra_test_data/${url}`))
})

setup()

const timeout = 30_000
const delay = { timeout }

test(
  'hic',
  async () => {
    const { view, findByTestId } = await createView(hicConfig)

    view.setNewView(5000, 0)
    fireEvent.click(await findByTestId(hts('hic_test'), {}, delay))
    await findByTestId('hic-display-done', {}, delay)
    expectCanvasMatch(await findByTestId('hic_canvas', {}, delay))
  },
  timeout,
)

// The bins are drawn as fillRects rotated -45° by the ctx transform stack, and
// fit-to-height then scales y alone. Only the composed matrix reaching the SVG
// tells us the two were applied in that order: `a === c` and `b === -d` is the
// signature of rotate-then-scale, i.e. a triangle sitting on the diagonal.
// Scaling before rotating breaks both equalities and tilts the whole matrix.
test(
  'hic fit-to-height SVG export keeps the triangle on the diagonal',
  async () => {
    const { view, findByTestId } = await createView(hicConfig)

    view.setNewView(5000, 0)
    fireEvent.click(await findByTestId(hts('hic_test'), {}, delay))
    await findByTestId('hic-display-done', {}, delay)

    const display = view.tracks[0]!.displays[0] as LinearHicDisplayModel
    display.setSquashToHeight(true)
    const { yScalar } = display
    expect(yScalar).not.toBe(1)

    await view.exportSvg({ rasterizeLayers: false })
    const [a, b, c, d] = /matrix\(([^)]*)\)/
      .exec(getSavedSvg())![1]!
      .split(' ')
      .map(Number) as [number, number, number, number]

    expect(c).toBe(a)
    expect(b).toBe(-d)
    // the export rounds transforms to 2 decimals, so compare the ratio loosely
    expect(Math.abs(d / a - yScalar) / yScalar).toBeLessThan(0.01)
  },
  timeout,
)
