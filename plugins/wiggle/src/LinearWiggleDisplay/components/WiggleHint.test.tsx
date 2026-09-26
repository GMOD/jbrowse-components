import { render } from '@testing-library/react'

import WiggleHint from './WiggleHint.tsx'

import type { HintModel } from './WiggleHint.tsx'

// The one state where the plot draws but cannot be read, so the smear is worth
// naming. Everything else must stay silent — a hint parked over a working
// figure is worse than no hint.
function makeModel(overrides: Partial<HintModel> = {}): HintModel {
  return {
    numSources: 2,
    isOverlay: false,
    isDensityMode: false,
    effectiveRowHeight: 50,
    height: 100,
    ...overrides,
  }
}

describe('rows packed below a pixel', () => {
  it('says how many rows are in how much height', () => {
    const { getByText } = render(
      <WiggleHint
        model={makeModel({
          numSources: 400,
          effectiveRowHeight: 0.25,
          height: 100,
        })}
      />,
    )
    getByText(
      /400 subtracks in 100px leaves rows below 1px\. Pick Plot type → Overlapping/,
    )
  })

  // In density the escape the message names IS the mode the user picked, and
  // sub-pixel rows are the intended cohort view — a thousand-sample heatmap is
  // read as a stack, not row by row.
  it('stays quiet in density mode', () => {
    const { container } = render(
      <WiggleHint
        model={makeModel({
          numSources: 400,
          effectiveRowHeight: 0.25,
          isDensityMode: true,
        })}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  // Overlay collapses every source onto one full-height plot, so there are no
  // thin rows to warn about.
  it('stays quiet in an overlay rendering', () => {
    const { container } = render(
      <WiggleHint
        model={makeModel({
          numSources: 400,
          effectiveRowHeight: 100,
          isOverlay: true,
        })}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})

it('stays quiet over a plot that is drawing normally', () => {
  const { container } = render(<WiggleHint model={makeModel()} />)
  expect(container.firstChild).toBeNull()
})
