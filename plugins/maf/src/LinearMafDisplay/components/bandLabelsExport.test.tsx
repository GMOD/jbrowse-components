import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import { createMafTestEnvironment } from '../testEnv.ts'
import MafBandLabels, { SvgBandLabels } from './MafBandLabels.tsx'
import { YSCALE_AXIS_WIDTH } from './MafYScaleGutter.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

const theme = createJBrowseTheme()

const COVERAGE_HEIGHT = 45
const CONSERVATION_HEIGHT = 40

function draw(labels: { text: string; top: number }[]) {
  const { container } = render(
    <svg>
      <SvgBandLabels labels={labels} theme={theme} />
    </svg>,
  )
  return [...container.querySelectorAll('text')]
}

const BOTH_BANDS = [
  { text: 'Coverage', top: 0 },
  { text: 'Conservation (% identity)', top: COVERAGE_HEIGHT },
]

// The exported figure used to carry no band titles at all, which is the case
// they exist for: two filled histograms in the same palette, stacked, told apart
// only by their Y-axis units — and an exported PNG cannot be hovered.
describe('band titles reach the SVG export', () => {
  it('emits one caption per band, with its text', () => {
    expect(draw(BOTH_BANDS).map(t => t.textContent)).toEqual([
      'Coverage',
      'Conservation (% identity)',
    ])
  })

  // The whole point of the caption is to say which band you are looking at, so
  // landing in the neighbouring one is worse than not drawing. `<text>` is
  // placed by its baseline while the on-screen label is a padded block, so the
  // offset between the two is real arithmetic and not a formality.
  it('puts each caption inside the band it names', () => {
    const [coverage, conservation] = draw(BOTH_BANDS)
    const y = (t: Element | undefined) => Number(t!.getAttribute('y'))
    const fontSize = Number(coverage!.getAttribute('font-size'))

    // baseline below the band's top edge by about a line, and clear of the
    // band's floor by more than the descender
    expect(y(coverage)).toBeGreaterThan(0)
    expect(y(coverage)).toBeLessThan(COVERAGE_HEIGHT - fontSize)
    expect(y(conservation)).toBeGreaterThan(COVERAGE_HEIGHT)
    expect(y(conservation)).toBeLessThan(
      COVERAGE_HEIGHT + CONSERVATION_HEIGHT - fontSize,
    )
  })

  // The two bands share one Y-axis gutter, and a caption drawn over its tick
  // labels is unreadable in exactly the figure it is meant to caption.
  it('clears the Y-axis gutter the bands share', () => {
    for (const t of draw(BOTH_BANDS)) {
      expect(Number(t.getAttribute('x'))).toBeGreaterThanOrEqual(
        YSCALE_AXIS_WIDTH,
      )
    }
  })

  it('draws nothing when the model titles nothing', () => {
    expect(draw([])).toEqual([])
  })
})

// The on-screen half, which the export half mirrors. A pure refactor — two
// hardcoded divs became a map over `model.bandLabels` — but the captions are
// what the export test is comparing itself against, so both ends of the pair
// are pinned rather than one.
describe('band titles on screen', () => {
  function screenLabels(configure: (d: LinearMafDisplayModel) => void) {
    const { display } = createMafTestEnvironment().createDisplay()
    configure(display)
    const { container } = render(
      <ThemeProvider theme={theme}>
        <MafBandLabels model={display} />
      </ThemeProvider>,
    )
    return [...container.querySelectorAll('div')]
  }

  it('titles both bands, each at its band top', () => {
    const divs = screenLabels(d => {
      d.setShowConservation(true)
    })
    expect(divs.map(d => d.textContent)).toEqual([
      'Coverage',
      'Conservation (% identity)',
    ])
    expect(divs[0]!.style.top).toBe('0px')
    expect(divs[1]!.style.top).toBe(`${COVERAGE_HEIGHT}px`)
  })

  it('draws nothing with only one band up', () => {
    expect(screenLabels(() => {})).toEqual([])
  })
})
