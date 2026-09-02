import {
  CascadingMenu,
  createJBrowseTheme,
  resolveSubMenu,
} from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { getReadsMenuItems } from './reads.ts'

import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

afterEach(cleanup)

const noPin: Pin = {
  slot: 'unused',
  onValue: true,
  active: false,
  toggle: () => {},
}

// Only the fields "Show..." reads.
function makeModel(
  overrides?: Partial<{
    canCollapseGroupRows: boolean
    showCoverage: boolean
    isChainMode: boolean
  }>,
) {
  return {
    showLegend: false,
    setShowLegend: jest.fn(),
    showLegendDisplayTypeDefault: noPin,
    showCoverage: true,
    setShowCoverage: jest.fn(),
    showPileup: true,
    setShowPileup: jest.fn(),
    showMismatches: true,
    setShowMismatches: jest.fn(),
    showSoftClipping: false,
    setShowSoftClipping: jest.fn(),
    softClippingDisplayTypeDefault: noPin,
    isChainMode: false,
    showInterbaseIndicators: true,
    setShowInterbaseIndicators: jest.fn(),
    mismatchAlpha: false,
    setMismatchAlpha: jest.fn(),
    mismatchAlphaDisplayTypeDefault: noPin,
    canCollapseGroupRows: false,
    collapseGroupRows: false,
    setCollapseGroupRows: jest.fn(),
    ...overrides,
  }
}

function subMenuOf(model: ReturnType<typeof makeModel>) {
  const [showItem] = getReadsMenuItems(model)
  if (!showItem || !('subMenu' in showItem)) {
    throw new Error('expected a "Show..." submenu')
  }
  return resolveSubMenu(showItem)
}

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

// The invariant this menu is kept to. It is the longest submenu in the track
// menu, and what makes a long menu unreadable is rows that aren't the same kind
// of thing — an action, a header, a divider — not the row count. Both attempts
// at structure here (subHeader groups, a divider before the row cap) were
// reverted; the row cap moved to "Read height" instead. A new row that isn't a
// checkbox belongs in another menu, and this fails if one lands.
test('every row is a checkbox — no actions, headers or dividers', () => {
  for (const item of subMenuOf(makeModel({ canCollapseGroupRows: true }))) {
    expect(item.type).toBe('checkbox')
  }
})

// The same shape once MUI has laid it out: nothing renders as a bare label or a
// rule, so the eye never has to skip a row while scanning. Every row carries the
// checkbox role its type earns it, which is the rendered half of the assertion
// above.
test('renders as an unbroken list of menu rows', () => {
  const { baseElement } = renderRows(subMenuOf(makeModel()))
  const rows = [...baseElement.querySelectorAll('li')]
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.getAttribute('role')).toBe('menuitemcheckbox')
  }
})

test('the toggles fire against the model', () => {
  const model = makeModel()
  const { getByText } = renderRows(subMenuOf(model))
  fireEvent.click(getByText('Show legend'))
  fireEvent.click(getByText('Show mismatches'))
  fireEvent.click(getByText('Show coverage'))
  expect(model.setShowLegend).toHaveBeenCalledWith(true)
  expect(model.setShowMismatches).toHaveBeenCalledWith(false)
  expect(model.setShowCoverage).toHaveBeenCalledWith(false)
})

// This menu switches layers on and off; it does not decide which reads exist.
// The read categories that used to end it are filters — they drop reads in the
// worker — and now live under "Filter by..." (menus/filters.ts).
test('no read-category filter is offered here', () => {
  const { queryByText } = renderRows(subMenuOf(makeModel()))
  expect(queryByText('Show proper pairs')).toBeNull()
  expect(queryByText('Show reads without a mate')).toBeNull()
  expect(queryByText('Show only split alignments')).toBeNull()
})

// The row cap is sizing, so it left this menu for "Read height" — where the
// read size and the fixed/grow/fit modes already live.
test('the row cap is not here', () => {
  const { queryByText } = renderRows(subMenuOf(makeModel()))
  expect(queryByText('Set max layout height...')).toBeNull()
})

function interbaseRow(showCoverage: boolean) {
  return subMenuOf(makeModel({ showCoverage })).find(
    r => 'label' in r && r.label === 'Show interbase indicators',
  )
}

// Interbase marks are drawn in the coverage band, so the toggle greys out while
// the band is hidden rather than sitting there doing nothing.
// `renderers/interbaseNeedsCoverage.test.ts` is what says the dependency is
// real; this is what says the menu states it.
test('the interbase toggle follows the coverage band', () => {
  expect(interbaseRow(false)).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('Show coverage'),
  })
  expect(interbaseRow(true)).toMatchObject({ disabled: false })
})

function softClipRow(isChainMode: boolean) {
  return subMenuOf(makeModel({ isChainMode })).find(
    r => 'label' in r && r.label === 'Show soft clipping',
  )
}

// The worker forces soft clipping off in chain mode
// (`executeRenderAlignmentData`), so the row says so instead of taking a click
// that draws nothing. Gated, it carries no pin (next test).
test('the soft clipping toggle greys out in chain mode', () => {
  expect(softClipRow(true)).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('Chain layout'),
  })
  expect(softClipRow(true)).not.toHaveProperty('pin')
  expect(softClipRow(false)).not.toHaveProperty('disabled')
  expect(softClipRow(false)).toHaveProperty('pin')
})

// A disabled row's pin is disabled with it (`menuItemAdornment`), so gating a
// promotable row would also take away its "default for all tracks of this type"
// control — which is why the promotable rows here state their dependency in
// help text instead of greying out. Nothing gated may carry a pin.
test('no gated row carries a pin', () => {
  for (const row of subMenuOf(
    makeModel({ showCoverage: false, isChainMode: true }),
  )) {
    if ('disabled' in row && row.disabled) {
      expect(row).not.toHaveProperty('pin')
    }
  }
})
