import { backingScale } from '@jbrowse/render-core/canvas2dUtils'
import { render } from '@testing-library/react'

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

function createDisplay() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(Array.from({ length: 80 }, (_, i) => ({ name: `S${i}` })))
  display.setRowHeight(7.3)
  display.setShowRowSeparators(true)
  display.setScrollTop(40.37)
  return display
}

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
