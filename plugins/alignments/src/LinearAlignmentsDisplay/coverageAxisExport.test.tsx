import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import { CoverageScaleBars } from './renderSvg.tsx'

import type { LinearAlignmentsDisplayModel } from './model.ts'

type RenderSection = LinearAlignmentsDisplayModel['renderSections'][number]

const CANVAS_WIDTH = 800

const ticks = {
  items: [
    { value: 0, y: 40 },
    { value: 50, y: 0 },
  ],
  yTop: 0,
  yBottom: 40,
}

function section(overrides: Partial<RenderSection>) {
  return {
    groupKey: 'g1',
    label: 'group one',
    coverageTop: 0,
    coverageHeight: 45,
    ...overrides,
  } as RenderSection
}

function draw({
  sections,
  hasGroupLabels = false,
  left = 0,
  scaleTicks = ticks,
}: {
  sections: RenderSection[]
  hasGroupLabels?: boolean
  left?: number
  scaleTicks?: typeof ticks
}) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <CoverageScaleBars
          sections={sections}
          ticks={scaleTicks}
          left={left}
          hasGroupLabels={hasGroupLabels}
          canvasWidth={CANVAS_WIDTH}
        />
      </svg>
    </ThemeProvider>,
  )
  return container
}

// Absolute x of each tick label: YScaleBar grows its labels away from the spine
// (orientation 'left' leftward, 'right' rightward), so the local x is signed and
// only the spine translate makes it absolute.
function labelXs(container: Element) {
  const g = container.querySelector('g[transform]')
  const originX = Number(
    /translate\((-?[\d.]+)/.exec(g?.getAttribute('transform') ?? '')?.[1],
  )
  return [...(g?.querySelectorAll('text') ?? [])].map(
    t => originX + Number(t.getAttribute('x')),
  )
}

// Mirrors the on-screen CoverageAxisHost's three-way choice. The regression this
// guards: the export drew all three left-oriented at `left`, which put a full
// axis's labels at negative x (off the image) and the compact label underneath
// the group label chips.
describe('coverage y-axis export geometry', () => {
  it('keeps an ungrouped full axis inside the image', () => {
    // left=0 is the ordinary case; contentLeft is only non-zero when scrolled
    // before the genome start
    const xs = labelXs(draw({ sections: [section({})] }))
    expect(xs.length).toBeGreaterThan(0)
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0)
    }
  })

  // Keyed off the label chips being drawn, not off the section count: a
  // grouping that yields a single named section still draws one at the left
  // edge, and the axis has to clear it.
  it('puts a labelled full axis on the right, clear of the group labels', () => {
    const xs = labelXs(draw({ sections: [section({})], hasGroupLabels: true }))
    expect(xs.length).toBeGreaterThan(0)
    for (const x of xs) {
      // past the midpoint, and still inside the image
      expect(x).toBeGreaterThan(CANVAS_WIDTH / 2)
      expect(x).toBeLessThanOrEqual(CANVAS_WIDTH)
    }
  })

  it('right-aligns the compact label in both groupings', () => {
    for (const hasGroupLabels of [false, true]) {
      const t = draw({
        sections: [section({ coverageHeight: 20 })],
        hasGroupLabels,
      }).querySelector('text')
      expect(t?.getAttribute('text-anchor')).toBe('end')
      const x = Number(t?.getAttribute('x'))
      expect(x).toBeGreaterThan(CANVAS_WIDTH / 2)
      expect(x).toBeLessThanOrEqual(CANVAS_WIDTH)
    }
  })

  // Both ends of the compact label come off the same tick ladder the full axis
  // draws, so shrinking a band past COMPACT_AXIS_HEIGHT can't change what the
  // axis claims its floor is. A log scale floors the domain at one read and a
  // `minScore` bound starts it wherever the user put it, and `[0, max]` was
  // written as a literal — so a log-scaled band read "1" at 30px tall and "0" at
  // 29px.
  it.each([
    ['a log scale floored at one read', 1, '[1, 128]'],
    ['a minScore bound', 10, '[10, 128]'],
    ['an ordinary autoscaled domain', 0, '[0, 128]'],
  ])('reports the domain floor in the compact label: %s', (_n, min, text) => {
    const t = draw({
      sections: [section({ coverageHeight: 20 })],
      scaleTicks: {
        items: [
          { value: min, y: 40 },
          { value: 128, y: 0 },
        ],
        yTop: 0,
        yBottom: 40,
      },
    }).querySelector('text')
    expect(t?.textContent).toBe(text)
  })

  it('follows the content when scrolled before the genome start', () => {
    // an ungrouped axis is anchored to contentLeft, so a non-zero left shifts it
    const at0 = labelXs(draw({ sections: [section({})] }))
    const at30 = labelXs(draw({ sections: [section({})], left: 30 }))
    expect(at30[0]! - at0[0]!).toBe(30)
  })
})
