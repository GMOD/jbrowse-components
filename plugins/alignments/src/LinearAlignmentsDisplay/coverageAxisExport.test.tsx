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
  grouped = false,
  left = 0,
}: {
  sections: RenderSection[]
  grouped?: boolean
  left?: number
}) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <CoverageScaleBars
          sections={sections}
          ticks={ticks}
          left={left}
          grouped={grouped}
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

  it('puts a grouped full axis on the right, clear of the group labels', () => {
    const xs = labelXs(draw({ sections: [section({})], grouped: true }))
    expect(xs.length).toBeGreaterThan(0)
    for (const x of xs) {
      // past the midpoint, and still inside the image
      expect(x).toBeGreaterThan(CANVAS_WIDTH / 2)
      expect(x).toBeLessThanOrEqual(CANVAS_WIDTH)
    }
  })

  it('right-aligns the compact label in both groupings', () => {
    for (const grouped of [false, true]) {
      const t = draw({
        sections: [section({ coverageHeight: 20 })],
        grouped,
      }).querySelector('text')
      expect(t?.getAttribute('text-anchor')).toBe('end')
      const x = Number(t?.getAttribute('x'))
      expect(x).toBeGreaterThan(CANVAS_WIDTH / 2)
      expect(x).toBeLessThanOrEqual(CANVAS_WIDTH)
    }
  })

  it('follows the content when scrolled before the genome start', () => {
    // an ungrouped axis is anchored to contentLeft, so a non-zero left shifts it
    const at0 = labelXs(draw({ sections: [section({})] }))
    const at30 = labelXs(draw({ sections: [section({})], left: 30 }))
    expect(at30[0]! - at0[0]!).toBe(30)
  })
})
