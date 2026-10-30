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

// The sample list lands before the payload the cells paint from, so a grid
// drawn off it alone showed over an empty canvas, and on a phased track jumped
// to twice the rows once the payload's ploidy landed.
test('the separators wait for the payload the cells draw', () => {
  const display = createDisplay({ loaded: false })
  expect(display.sources).toHaveLength(80)
  const { container, rerender } = render(
    <VariantRowSeparators model={display} />,
  )
  expect(container.querySelectorAll('line')).toHaveLength(0)
  display.setCellData(cellDataOf({ rowNames: NAMES, sampleNames: NAMES }))
  rerender(<VariantRowSeparators model={display} />)
  expect(container.querySelectorAll('line').length).toBeGreaterThan(10)
})

const renderers: [string, (d: Display) => HTMLElement | SVGElement][] = [
  ['on screen', d => render(<VariantRowSeparators model={d} />).container],
  [
    'in the SVG export',
    d =>
      render(
        <svg>
          <SvgVariantOverlay model={d} width={800} overlays>
            <g />
          </SvgVariantOverlay>
        </svg>,
      ).container,
  ],
]

// Each line fills the device pixels just below a row's snapped top, the edge
// the cell painters and the GPU passes put that row on.
describe.each(renderers)('row separators %s', (_, renderLines) => {
  test.each([1, 1.25, 1.5, 2])('sit on the cells’ row edges at dpr %d', dpr => {
    withDpr(dpr, () => {
      const display = createDisplay()
      const { effectiveRowHeight, scrollTop, availableHeight } = display
      const scale = backingScale(availableHeight)
      const lines = [...renderLines(display).querySelectorAll('line')]
      expect(lines.length).toBeGreaterThan(10)
      const rowTops = new Set(
        Array.from({ length: 80 }, (_, row) =>
          snappedRowTopPx(row, effectiveRowHeight, scrollTop, scale).toFixed(6),
        ),
      )
      for (const line of lines) {
        const y = Number(line.getAttribute('y1'))
        const half = Number(line.getAttribute('stroke-width')) / 2
        const top = (y - half) * scale
        const bottom = (y + half) * scale
        expect(rowTops.has((y - half).toFixed(6))).toBe(true)
        expect(top).toBeCloseTo(Math.round(top), 6)
        expect(bottom).toBeCloseTo(Math.round(bottom), 6)
        expect(bottom - top).toBeGreaterThanOrEqual(1 - 1e-9)
      }
    })
  })
})
