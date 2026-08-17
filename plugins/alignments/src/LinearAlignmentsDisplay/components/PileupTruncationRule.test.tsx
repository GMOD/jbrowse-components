import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, render, screen } from '@testing-library/react'

import PileupTruncationRule from './PileupTruncationRule.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

afterEach(cleanup)

// Tall enough that both sections' boundaries are on screen at rest; the culling
// case gets its own fixture below.
const CANVAS_HEIGHT = 300
// Two 120px-tall sections, each a 40px coverage band over an 80px pileup, so
// the pileups end at content y 120 and 240.
const SECTION_HEIGHT = 120

const CAPTION = /Max height reached/
// The rule, not its caption. These used to read the caption's `top`, which was
// the same number only because the caption's own `top: 2` was being clobbered by
// the inline style — so the assertion held on a bug. The line is what "the
// boundary is here" means; the caption hangs `CAPTION_GAP_PX` below it.
const ruleTops = () =>
  screen.getAllByTestId('pileup-truncation-rule').map(r => r.style.top)

// `clipped` is per section, because that is where the component reads it: a
// `renderSections` entry IS its lane, `ceilingClipped` included, and the
// display-wide suppressions are folded in when the lane is built.
function renderRule(
  overrides: Partial<LinearAlignmentsDisplayModel> = {},
  clipped: (groupKey: string) => boolean = () => true,
) {
  const model = {
    scrollModel: { isGrouped: true, scrollTop: 0, canvasHeight: CANVAS_HEIGHT },
    renderSections: [0, 1].map(i => ({
      groupKey: `g${i}`,
      label: `HP: ${i + 1}`,
      coverageTop: i * SECTION_HEIGHT,
      coverageHeight: 40,
      topOffset: i * SECTION_HEIGHT + 40,
      pileupHeight: 80,
      height: SECTION_HEIGHT,
      ceilingClipped: clipped(`g${i}`),
    })),
    ...overrides,
  } as unknown as LinearAlignmentsDisplayModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PileupTruncationRule model={model} />
    </ThemeProvider>,
  )
}

// The whole point of moving this out of the corner: it marks the boundary the
// reads actually stop at, so it sits at the bottom of the laid-out rows.
test('the rule lands on the bottom edge of the clipped rows', () => {
  renderRule()
  expect(ruleTops()).toEqual(['120px', '240px'])
})

// Always-scrolling tier — `contentScreenY`, not `bandScreenTop`. A sticky
// projection would park the line over reads it is not the end of.
test('it scrolls with the reads', () => {
  renderRule({
    scrollModel: {
      isGrouped: true,
      scrollTop: 50,
      canvasHeight: CANVAS_HEIGHT,
    },
  })
  expect(ruleTops()).toEqual(['70px', '190px'])
})

// You meet the notice by scrolling to the end of the reads: a boundary 440px
// down a 300px canvas is not drawn at all until you get there, which is the
// behaviour the always-lit corner chip did not have.
test('a boundary below the viewport is not drawn until scrolled to', () => {
  renderRule({
    renderSections: [
      {
        groupKey: 'g0',
        topOffset: 40,
        pileupHeight: 400,
        coverageTop: 0,
        coverageHeight: 40,
        height: 440,
        // clipped, so the culling below is what keeps it off screen
        ceilingClipped: true,
      },
    ] as unknown as LinearAlignmentsDisplayModel['renderSections'],
  })
  expect(screen.queryByText(CAPTION)).toBeNull()
})

// The ceiling is display-wide but the boundary is not: a stacked grouping can
// have one lane clipped by it and the next sized comfortably.
test('only the clipped sections get a rule', () => {
  renderRule({}, key => key === 'g1')
  expect(ruleTops()).toEqual(['240px'])
})

// It is a notice, not a control — the old chip's press wrote a config slot, and
// dismissing that by accident is what this replaced.
test('nothing in it is clickable', () => {
  renderRule()
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
  for (const caption of screen.getAllByText(CAPTION)) {
    expect(caption.tagName).toBe('DIV')
  }
})
