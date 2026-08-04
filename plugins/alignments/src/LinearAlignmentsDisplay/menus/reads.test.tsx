import { CascadingMenu, createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { getReadsMenuItem } from './reads.ts'

import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

afterEach(cleanup)

const noPin: DisplayTypeDefaultControl = { active: false, toggle: () => {} }

// Only the fields "Show..." reads. `getMaxHeightMenuItem`'s getSession call is
// inside its onClick, so the row builds fine without a tree.
function makeModel(overrides?: Partial<{ canCollapseGroupRows: boolean }>) {
  return {
    showLegend: false,
    setShowLegend: jest.fn(),
    showCoverage: true,
    setShowCoverage: jest.fn(),
    showPileup: true,
    setShowPileup: jest.fn(),
    showMismatches: true,
    setShowMismatches: jest.fn(),
    showSoftClipping: false,
    setShowSoftClipping: jest.fn(),
    softClippingDisplayTypeDefault: noPin,
    showInterbaseIndicators: true,
    setShowInterbaseIndicators: jest.fn(),
    mismatchAlpha: false,
    setMismatchAlpha: jest.fn(),
    mismatchAlphaDisplayTypeDefault: noPin,
    drawProperPairs: true,
    setDrawProperPairs: jest.fn(),
    drawSingletons: true,
    setDrawSingletons: jest.fn(),
    showOnlySplitAlignments: false,
    setShowOnlySplitAlignments: jest.fn(),
    canCollapseGroupRows: false,
    collapseGroupRows: false,
    setCollapseGroupRows: jest.fn(),
    maxHeight: 1200,
    setMaxHeight: jest.fn(),
    ...overrides,
  }
}

function subMenuOf(model: ReturnType<typeof makeModel>) {
  return getReadsMenuItem(model).subMenu as MenuItem[]
}

// Where each label sits in DOM order. A header renders as a plain `li` and a
// row as `role="menuitem"`, so the list is walked rather than queried by role —
// the point of these specs is the interleaving of the two.
function rowFinder(root: Element) {
  const text = [...root.querySelectorAll('li')].map(el => el.textContent)
  return (label: string) => text.findIndex(t => t.startsWith(label))
}

// Renders the rows through the real CascadingMenu rather than asserting on the
// item objects: the headers only pay off if they actually land between the right
// rows once MUI has laid the list out, and the same pass computes the shared
// trailing column that the pins and "?" buttons claim.
function renderRows(items: MenuItem[]) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CascadingMenu
        open
        menuItems={items}
        onMenuItemClick={(cb: () => void) => {
          cb()
        }}
        onClose={() => {}}
      />
    </ThemeProvider>,
  )
}

test('the rows are grouped under headers, in order', () => {
  const { baseElement } = renderRows(subMenuOf(makeModel()))
  const at = rowFinder(baseElement)

  expect(at('Layers')).toBeGreaterThanOrEqual(0)
  expect(at('Show legend')).toBeGreaterThan(at('Layers'))
  expect(at('Read detail')).toBeGreaterThan(at('Show pileup'))
  expect(at('Show mismatches')).toBeGreaterThan(at('Read detail'))
  expect(at('Which reads')).toBeGreaterThan(at('Show soft clipping'))
  expect(at('Show proper pairs')).toBeGreaterThan(at('Which reads'))
  expect(at('Set max layout height...')).toBeGreaterThan(
    at('Show only split alignments'),
  )
})

// A header is a label, not a row — it must not be clickable or steal the
// checkbox column, or the grouping costs more than it buys.
test('the headers are inert', () => {
  const model = makeModel()
  const { getByText } = renderRows(subMenuOf(model))
  for (const header of ['Layers', 'Read detail', 'Which reads']) {
    fireEvent.click(getByText(header))
  }
  expect(model.setShowLegend).not.toHaveBeenCalled()
  expect(model.setShowMismatches).not.toHaveBeenCalled()
  expect(model.setDrawProperPairs).not.toHaveBeenCalled()
})

test('the toggles still fire from their groups', () => {
  const model = makeModel()
  const { getByText } = renderRows(subMenuOf(model))
  fireEvent.click(getByText('Show legend'))
  fireEvent.click(getByText('Show mismatches'))
  fireEvent.click(getByText('Show proper pairs'))
  expect(model.setShowLegend).toHaveBeenCalledWith(true)
  expect(model.setShowMismatches).toHaveBeenCalledWith(false)
  expect(model.setDrawProperPairs).toHaveBeenCalledWith(false)
})

// The collapse row is conditional, so the "Layers" group has to hold it without
// the later headers drifting into the wrong group.
test('the conditional collapse row joins Layers, not Read detail', () => {
  const { baseElement } = renderRows(
    subMenuOf(makeModel({ canCollapseGroupRows: true })),
  )
  const at = rowFinder(baseElement)
  expect(at('Collapse groups to one row')).toBeGreaterThan(at('Show pileup'))
  expect(at('Collapse groups to one row')).toBeLessThan(at('Read detail'))
})
