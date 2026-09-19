import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import MultiWiggleHint from './MultiWiggleHint.tsx'

import type { HintModel } from './MultiWiggleHint.tsx'

// The two states where the plot draws nothing but the data is fine, so the
// blank is recoverable and worth naming. Everything else must stay silent —
// a hint parked over a working figure is worse than no hint.
function makeModel(overrides: Partial<HintModel> = {}): HintModel {
  return {
    numSources: 2,
    isOverlay: false,
    isDensityMode: false,
    effectiveRowHeight: 50,
    height: 100,
    sourcesWithoutLayout: [{ name: 'a' }, { name: 'b' }],
    subtreeFilter: undefined,
    setSubtreeFilter: jest.fn(),
    ...overrides,
  }
}

describe('subtree filter matching nothing', () => {
  // Sources loaded but every one filtered out. Since buildSourceRenderData
  // stopped falling back to the payload this really is a blank plot, so the
  // message is the only thing on it.
  it('names the filter and offers to clear it', async () => {
    const setSubtreeFilter = jest.fn()
    const { getByText } = render(
      <MultiWiggleHint
        model={makeModel({
          numSources: 0,
          subtreeFilter: ['nothing_here'],
          setSubtreeFilter,
        })}
      />,
    )
    getByText('No subtracks match the current subtree filter')
    await userEvent.click(getByText('Clear subtree filter'))
    expect(setSubtreeFilter).toHaveBeenCalledWith(undefined)
  })

  // Before the first fetch lands there are no sources at all, which is loading
  // rather than a filter that matched nothing.
  it('stays quiet before any source has loaded', () => {
    const { container } = render(
      <MultiWiggleHint
        model={makeModel({ numSources: 0, sourcesWithoutLayout: [] })}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('rows packed below a pixel', () => {
  it('says how many rows are in how much height', () => {
    const { getByText } = render(
      <MultiWiggleHint
        model={makeModel({
          numSources: 400,
          effectiveRowHeight: 0.25,
          height: 100,
        })}
      />,
    )
    getByText(/400 subtracks in 100px leaves rows below 1px/)
  })

  // Clearing the filter is the fix for the other case and would make this one
  // strictly worse, so it carries no button.
  it('offers no clear-filter escape', () => {
    const { queryByText } = render(
      <MultiWiggleHint
        model={makeModel({
          numSources: 400,
          effectiveRowHeight: 0.25,
          subtreeFilter: ['a'],
        })}
      />,
    )
    expect(queryByText('Clear subtree filter')).toBeNull()
  })

  // In density the escape the message names IS the mode the user picked, and
  // sub-pixel rows are the intended cohort view — a thousand-sample heatmap is
  // read as a stack, not row by row.
  it('stays quiet in density mode', () => {
    const { container } = render(
      <MultiWiggleHint
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
      <MultiWiggleHint
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
  const { container } = render(<MultiWiggleHint model={makeModel()} />)
  expect(container.firstChild).toBeNull()
})
