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

interface Band {
  top: number
  height: number
}

// On screen the separators are HTML boxes, in the export SVG lines.
const renderers: [string, (d: Display) => Band[]][] = [
  [
    'on screen',
    d =>
      [
        ...render(
          <VariantRowSeparators model={d} />,
        ).container.querySelectorAll<HTMLElement>(
          '[data-testid="variant-row-separators"] > div',
        ),
      ].map(div => ({
        top: Number.parseFloat(div.style.top),
        height: Number.parseFloat(div.style.height),
      })),
  ],
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
