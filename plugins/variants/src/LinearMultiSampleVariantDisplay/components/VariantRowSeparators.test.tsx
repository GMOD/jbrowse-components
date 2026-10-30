import { backingScale } from '@jbrowse/render-core/canvas2dUtils'
import { render } from '@testing-library/react'

import { cellDataOf } from '../../shared/cellDataFixtures.ts'
import { createTestEnvironment } from '../testEnv.ts'
import SvgVariantOverlay from './SvgVariantOverlay.tsx'
import VariantRowSeparators from './VariantRowSeparators.tsx'
import { snappedRowTopPx } from './shaders/variant.js.generated.ts'

type Display = ReturnType<
  ReturnType<typeof createTestEnvironment>['createDisplay']
>['display']

function withDpr<T>(dpr: number, run: () => T) {
  const before = window.devicePixelRatio
  window.devicePixelRatio = dpr
  try {
    return run()
  } finally {
    window.devicePixelRatio = before
  }
}

const NAMES = Array.from({ length: 80 }, (_, i) => `S${i}`)

function createDisplay({ loaded = true } = {}) {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(NAMES.map(name => ({ name })))
  display.setRowHeight(7.3)
  display.setShowRowSeparators(true)
  display.setScrollTop(40.37)
  if (loaded) {
    display.setCellData(cellDataOf({ rowNames: NAMES, sampleNames: NAMES }))
  }
  return display
}

interface Band {
  top: number
  height: number
}

function onScreenBands(d: Display): Band[] {
  return [
    ...render(
      <VariantRowSeparators model={d} />,
    ).container.querySelectorAll<HTMLElement>(
      '[data-testid="variant-row-separators"] > div',
    ),
  ].map(div => ({
    top: Number.parseFloat(div.style.top),
    height: Number.parseFloat(div.style.height),
  }))
}

// The sample list lands before the payload the cells paint from, so a grid
// drawn off it alone showed over an empty canvas, and on a phased track jumped
// to twice the rows once the payload's ploidy landed.
test('the separators wait for the payload the cells draw', () => {
  const display = createDisplay({ loaded: false })
  expect(display.sources).toHaveLength(80)
  expect(onScreenBands(display)).toHaveLength(0)
  display.setCellData(cellDataOf({ rowNames: NAMES, sampleNames: NAMES }))
  expect(onScreenBands(display).length).toBeGreaterThan(10)
})

// On screen the separators are HTML boxes, in the export SVG lines.
const renderers: [string, (d: Display) => Band[]][] = [
  ['on screen', onScreenBands],
  [
    'in the SVG export',
    d =>
      [
        ...render(
          <svg>
            <SvgVariantOverlay model={d} width={800} overlays>
              <g />
            </SvgVariantOverlay>
          </svg>,
        ).container.querySelectorAll('line'),
      ].map(line => {
        const height = Number(line.getAttribute('stroke-width'))
        return { top: Number(line.getAttribute('y1')) - height / 2, height }
      }),
  ],
]

// Each separator fills the device pixels just below a row's snapped top, the
// edge the cell painters and the GPU passes put that row on.
describe.each(renderers)('row separators %s', (_, bandsOf) => {
  test.each([1, 1.25, 1.5, 2])('sit on the cells’ row edges at dpr %d', dpr => {
    withDpr(dpr, () => {
      const display = createDisplay()
      const { effectiveRowHeight, scrollTop, availableHeight } = display
      const scale = backingScale(availableHeight)
      const bands = bandsOf(display)
      expect(bands.length).toBeGreaterThan(10)
      const rowTops = new Set(
        Array.from({ length: 80 }, (_, row) =>
          snappedRowTopPx(row, effectiveRowHeight, scrollTop, scale).toFixed(6),
        ),
      )
      for (const { top, height } of bands) {
        const deviceTop = top * scale
        const deviceBottom = (top + height) * scale
        expect(rowTops.has(top.toFixed(6))).toBe(true)
        expect(deviceTop).toBeCloseTo(Math.round(deviceTop), 6)
        expect(deviceBottom).toBeCloseTo(Math.round(deviceBottom), 6)
        expect(deviceBottom - deviceTop).toBeGreaterThanOrEqual(1 - 1e-9)
      }
    })
  })
})
