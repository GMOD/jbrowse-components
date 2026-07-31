import { ThemeProvider } from '@mui/material'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import CascadingMenu from './CascadingMenu.tsx'
import { promotableRadioItem } from './promotableMenuItems.tsx'
import { createJBrowseTheme } from './theme.ts'

import type { MenuItem } from './MenuTypes.ts'

const theme = createJBrowseTheme()

afterEach(cleanup)

function renderMenu(menuItems: MenuItem[]) {
  const onMenuItemClick = jest.fn((cb: () => void) => {
    cb()
  })
  const utils = render(
    <ThemeProvider theme={theme}>
      <CascadingMenu
        open
        menuItems={menuItems}
        onMenuItemClick={onMenuItemClick}
        onClose={() => {}}
      />
    </ThemeProvider>,
  )
  return { ...utils, onMenuItemClick }
}

describe('CascadingMenu endAdornment', () => {
  it("renders an item's endAdornment", () => {
    const { getByTestId } = renderMenu([
      {
        type: 'checkbox',
        label: 'Alpha',
        checked: false,
        onClick: () => {},
        endAdornment: <span data-testid="adorn">pin</span>,
      },
      { type: 'checkbox', label: 'Beta', checked: true, onClick: () => {} },
    ])
    expect(getByTestId('adorn')).toBeTruthy()
  })

  it('renders rows normally when no item has an endAdornment', () => {
    const { getByText, queryByTestId } = renderMenu([
      { type: 'checkbox', label: 'Alpha', checked: false, onClick: () => {} },
    ])
    expect(getByText('Alpha')).toBeTruthy()
    expect(queryByTestId('adorn')).toBeNull()
  })

  it('a row click still fires onMenuItemClick with an adornment present', () => {
    const onClick = jest.fn()
    const { getByText, onMenuItemClick } = renderMenu([
      {
        type: 'checkbox',
        label: 'Alpha',
        checked: false,
        onClick,
        endAdornment: <span data-testid="adorn">pin</span>,
      },
    ])
    fireEvent.click(getByText('Alpha'))
    expect(onMenuItemClick).toHaveBeenCalled()
    expect(onClick).toHaveBeenCalled()
  })

  // The promotable pin's filled state, and a size row's "reset" enablement, are
  // plain booleans captured when the items are BUILT — so the whole subsystem
  // rests on the menu rebuilding while it stays open (every promotable row sets
  // `keepMenuOpen`, and clicking a pin is expected to fill it in place). That
  // works because `CascadingMenu` is an observer and calls a `menuItems` getter
  // inside its own render, so whatever the build reads — here a promoted
  // display-type default, in production the session's preference map — is
  // tracked. Pin this, or a "cheap" memo of the items array silently freezes
  // every pin until the menu is reopened.
  it('re-runs a menuItems getter when an observable it read changes, so a pin fills in place', () => {
    const promoted = observable.box('normal')
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <CascadingMenu
          open
          menuItems={() => [
            promotableRadioItem({
              label: 'Compact',
              checked: false,
              onClick: () => {},
              displayTypeDefault: {
                active: promoted.get() === 'compact',
                toggle: () => {},
              },
            }),
          ]}
          onMenuItemClick={cb => {
            cb()
          }}
          onClose={() => {}}
        />
      </ThemeProvider>,
    )
    const pin = () =>
      getByRole('button', { name: 'make Compact the default for all tracks' })
    expect(pin().getAttribute('aria-pressed')).toBe('false')

    // the model moves with the menu still mounted — no reopen, no rerender call
    act(() => {
      runInAction(() => {
        promoted.set('compact')
      })
    })
    expect(pin().getAttribute('aria-pressed')).toBe('true')
  })

  it('an adornment that stops propagation does not fire the row click', () => {
    const onClick = jest.fn()
    const { getByTestId, onMenuItemClick } = renderMenu([
      {
        type: 'checkbox',
        label: 'Alpha',
        checked: false,
        onClick,
        endAdornment: (
          <button
            type="button"
            data-testid="adorn"
            onClick={e => {
              e.stopPropagation()
            }}
          >
            pin
          </button>
        ),
      },
    ])
    fireEvent.click(getByTestId('adorn'))
    expect(onMenuItemClick).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })
})
