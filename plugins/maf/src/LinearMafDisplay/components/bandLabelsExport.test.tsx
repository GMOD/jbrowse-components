import { getSession } from '@jbrowse/core/util'
import { AXIS_GUTTER_WIDTH_PX } from '@jbrowse/wiggle-core'
import { fireEvent, render, screen } from '@testing-library/react'

import { createMafTestEnvironment } from '../testEnv.ts'
import MafBandLabels, { SvgMafBandLabels } from './MafBandLabels.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

const COVERAGE_HEIGHT = 45
const CONSERVATION_HEIGHT = 40

function draw(labels: { text: string; top: number }[]) {
  const { container } = render(
    <svg>
      <SvgMafBandLabels labels={labels} />
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
        AXIS_GUTTER_WIDTH_PX,
      )
    }
  })

  it('draws nothing when the model titles nothing', () => {
    expect(draw([])).toEqual([])
  })
})

// The on-screen half: the same titles as chips, each at its band's top, whose
// × hides that band.
describe('band chips on screen', () => {
  function screenChips(configure: (d: LinearMafDisplayModel) => void) {
    const { display } = createMafTestEnvironment().createDisplay()
    configure(display)
    render(<MafBandLabels model={display} />)
    return display
  }

  it('titles both bands, each at its band top', () => {
    screenChips(d => {
      d.setShowConservation(true)
    })
    expect(screen.getByTestId('band_chips_coverage').textContent).toBe(
      'Coverage',
    )
    expect(screen.getByTestId('band_chips_conservation').textContent).toBe(
      'Conservation (% identity)',
    )
    expect(screen.getByTestId('band_chips_coverage').style.top).toBe('1px')
    expect(screen.getByTestId('band_chips_conservation').style.top).toBe(
      `${COVERAGE_HEIGHT + 1}px`,
    )
  })

  it('draws nothing with only one band up', () => {
    screenChips(() => {})
    expect(screen.queryByTestId('band_chips_coverage')).toBeNull()
  })

  it('draws no chips once the viewer turns band chips off', () => {
    screenChips(d => {
      d.setShowConservation(true)
      getSession(d).setPreferenceOverride('showBandChips', false)
    })
    expect(screen.queryByTestId('band_chips_coverage')).toBeNull()
    expect(screen.queryByTestId('band_chips_conservation')).toBeNull()
  })

  it('hides the coverage from its chip', () => {
    const display = screenChips(d => {
      d.setShowConservation(true)
    })
    fireEvent.click(screen.getByTitle('Hide coverage'))
    expect(display.showCoverage).toBe(false)
    expect(display.showConservation).toBe(true)
  })

  it('hides the conservation from its chip', () => {
    const display = screenChips(d => {
      d.setShowConservation(true)
    })
    fireEvent.click(screen.getByTitle('Hide conservation (% identity)'))
    expect(display.showConservation).toBe(false)
    expect(display.showCoverage).toBe(true)
  })
})
