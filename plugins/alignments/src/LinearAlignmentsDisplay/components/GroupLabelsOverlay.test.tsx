import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, render, screen } from '@testing-library/react'

import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

afterEach(cleanup)

const CANVAS_HEIGHT = 200
// Two 120px-tall sections, each a 40px coverage band over an 80px pileup.
const SECTION_HEIGHT = 120
const CONTENT_HEIGHT = SECTION_HEIGHT * 2

// The positioned element is the chip, not the text node's parent — the label
// sits in a span of its own so the browser suite can read it.
function chipTop(label: string) {
  return /top:\s*([^;]+)/.exec(
    screen
      .getByText(label)
      .closest('[data-testid="group-label-chip"]')!
      .getAttribute('style')!,
  )![1]!
}

function renderOverlay(overrides: Partial<LinearAlignmentsDisplayModel> = {}) {
  const showPileup = overrides.showPileup ?? true
  const model = {
    showsGroupLabels: true,
    showPileup,
    collapseGroupRows: false,
    // as the model resolves it — there is nothing to size when the pileup is
    // hidden, so a fake that ticked it on would test a state that can't happen
    canSizeGroupHeights: showPileup,
    featureNoun: 'read',
    scrollModel: { isGrouped: true, scrollTop: 0, canvasHeight: CANVAS_HEIGHT },
    sections: { contentHeight: CONTENT_HEIGHT },
    // A section IS its lane, chip state included — the overlay reads these
    // fields rather than looking each one back up by `groupKey`.
    renderSections: [0, 1].map(i => ({
      groupKey: `g${i}`,
      label: `HP: ${i + 1}`,
      coverageTop: i * SECTION_HEIGHT,
      coverageHeight: 40,
      topOffset: i * SECTION_HEIGHT + 40,
      pileupHeight: 80,
      height: SECTION_HEIGHT,
      collapsed: false,
      hasHeightOverride: false,
      // Clipped by the lane's viewport slice, which is the cap the chip's expand
      // can raise.
      clippedBy: 'budget',
    })),
    toggleGroupCollapsed: jest.fn(),
    toggleGroupExpanded: jest.fn(),
    ...overrides,
  } as unknown as LinearAlignmentsDisplayModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelsOverlay model={model} />
    </ThemeProvider>,
  )
}

// The chip is the header for the whole strip down to the next section, not for
// the coverage band it happens to sit on. Culling on the band alone dropped the
// name of a group still filling the viewport — and with coverage hidden the band
// is 0px tall, so the name went the moment the section's top edge scrolled past.
test('a group scrolled past its coverage band keeps its label, pinned at the top', () => {
  renderOverlay({
    scrollModel: {
      isGrouped: true,
      scrollTop: 60,
      canvasHeight: CANVAS_HEIGHT,
    },
  })
  expect(chipTop('HP: 1')).toBe('1px')
  // the section below it still sits at its own (scrolled) top
  expect(chipTop('HP: 2')).toBe('61px')
})

// ... but the pin stops at the section's own bottom edge, or a group on its way
// off the top would park its name over the next group's.
test('the pinned label yields to the next section', () => {
  renderOverlay({
    scrollModel: {
      isGrouped: true,
      scrollTop: SECTION_HEIGHT - 4,
      canvasHeight: CANVAS_HEIGHT,
    },
  })
  // 4px of section 1 left on screen, and the chip is 16px tall
  expect(chipTop('HP: 1')).toBe('-11px')
  expect(chipTop('HP: 2')).toBe('5px')
})

test('a section entirely above the viewport drops its label', () => {
  renderOverlay({
    scrollModel: {
      isGrouped: true,
      scrollTop: SECTION_HEIGHT + 10,
      canvasHeight: CANVAS_HEIGHT,
    },
  })
  expect(screen.queryByText('HP: 1')).toBeNull()
  expect(screen.queryByText('HP: 2')).not.toBeNull()
})

// The height button and the drag handles write the same override, so they are
// offered together — `canSizeGroupHeights` is false in fit mode and with the
// pileup hidden.
test('no height affordance when group heights cannot be set', () => {
  renderOverlay()
  expect(screen.getAllByTitle(/Show all reads/)).toHaveLength(2)
  cleanup()
  renderOverlay({ canSizeGroupHeights: false })
  expect(screen.queryByTitle(/Show all reads/)).toBeNull()
})

// One row per group is a compact reading for many groups, so the button text
// that would cover the left of every lane goes away with it.
test('collapsed-row lanes get an icon-only expand button', () => {
  renderOverlay({ collapseGroupRows: true })
  const buttons = screen.getAllByTitle(
    'Expand this group into a stacked layout',
  )
  expect(buttons).toHaveLength(2)
  expect(buttons.map(b => b.textContent)).toEqual(['', ''])
})

// Nothing to collapse or resize on a coverage-only stack, so the chip is a
// plain label rather than a dead button.
test('the pileup hidden leaves plain labels', () => {
  renderOverlay({ showPileup: false })
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('HP: 1')).toBeDefined()
})
