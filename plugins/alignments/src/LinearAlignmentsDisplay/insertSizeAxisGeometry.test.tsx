import { resolvePalette } from '@jbrowse/core/ui/palette'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import InsertSizeAxis from './components/InsertSizeAxis.tsx'
import { AXIS_SVG_WIDTH, insertSizeAxisBoxLeft } from './coverageAxisStyle.ts'

const CANVAS_WIDTH = 800

const ticks = {
  items: [
    { value: 1, y: 0, label: '0' },
    { value: 1000, y: 40, label: '1kb' },
  ],
  yTop: 0,
  yBottom: 40,
}

// Absolute x of every text the axis draws — every enclosing translate summed,
// not just the nearest one. YScaleBar grows its labels away from the spine, so
// the local x is signed and only the chain of translates makes it absolute,
// which is exactly why the spine was worth sharing.
function absoluteTextXs(container: Element) {
  return [...container.querySelectorAll('text')].map(t => {
    let x = Number(t.getAttribute('x'))
    for (
      let node = t.parentElement;
      node && node !== container;
      node = node.parentElement
    ) {
      const dx = /translate\((-?[\d.]+)/.exec(
        node.getAttribute('transform') ?? '',
      )?.[1]
      x += Number(dx ?? 0)
    }
    return x
  })
}

function draw(down: boolean, boxLeft: number) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <g transform={`translate(${boxLeft}, 0)`}>
          <InsertSizeAxis
            ticks={ticks}
            down={down}
            palette={resolvePalette()}
          />
        </g>
      </svg>
    </ThemeProvider>,
  )
  return absoluteTextXs(container)
}

// The regression: the on-screen overlay placed the down-mode spine at
// `AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET` while the export spelled it 40, so
// every exported figure's TLEN numbers sat 5px left of the ones on screen. One
// component now owns the inside of the box and each path supplies only where the
// box is, so the two can only differ if `insertSizeAxisBoxLeft` disagrees with
// the overlay's `left: 0` / `right: 0` — which these pin.
describe('insert-size axis geometry', () => {
  it('puts the down-mode box at the left edge, its labels inside it', () => {
    const boxLeft = insertSizeAxisBoxLeft(CANVAS_WIDTH, true)
    expect(boxLeft).toBe(0)
    for (const x of draw(true, boxLeft)) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(AXIS_SVG_WIDTH)
    }
  })

  it('puts the up-mode box flush with the right edge, its labels inside it', () => {
    const boxLeft = insertSizeAxisBoxLeft(CANVAS_WIDTH, false)
    expect(boxLeft).toBe(CANVAS_WIDTH - AXIS_SVG_WIDTH)
    for (const x of draw(false, boxLeft)) {
      expect(x).toBeGreaterThanOrEqual(boxLeft)
      expect(x).toBeLessThanOrEqual(CANVAS_WIDTH)
    }
  })

  it('keeps the TLEN caption clear of the numbers on both sides', () => {
    // down mode: numbers grow leftward from the spine, so the caption is left of
    // all of them; up mode: rightward, so it is right of all of them
    const down = draw(true, insertSizeAxisBoxLeft(CANVAS_WIDTH, true))
    expect(down.at(-1)).toBeLessThan(Math.min(...down.slice(0, -1)))

    const up = draw(false, insertSizeAxisBoxLeft(CANVAS_WIDTH, false))
    expect(up.at(-1)).toBeGreaterThan(Math.max(...up.slice(0, -1)))
  })
})
