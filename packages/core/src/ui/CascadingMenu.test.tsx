import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import CascadingMenu from './CascadingMenu.tsx'
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
