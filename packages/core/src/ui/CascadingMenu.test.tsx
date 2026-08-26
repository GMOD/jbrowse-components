import { ThemeProvider } from '@mui/material'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import CascadingMenu from './CascadingMenu.tsx'
import { promotableRadioItem } from './promotableMenuItems.ts'
import { createJBrowseTheme } from './theme.ts'

import type { MenuItem } from './MenuTypes.ts'

const theme = createJBrowseTheme()

afterEach(cleanup)

function renderMenu(menuItems: MenuItem[]) {
  const onMenuItemClick = jest.fn((cb: () => void) => {
    cb()
  })
  const onClose = jest.fn()
  const utils = render(
    <ThemeProvider theme={theme}>
      <CascadingMenu
        open
        menuItems={menuItems}
        onMenuItemClick={onMenuItemClick}
        onClose={onClose}
      />
    </ThemeProvider>,
  )
  return { ...utils, onMenuItemClick, onClose }
}

// The reservation that lines a clickable row's "?" up with a submenu row's is
// the chevron ITSELF, drawn invisible — a spelled width cannot be right, because
// `pxToRem` scales every icon by the theme's base font size and this theme's is
// 12, not MUI's 14. The column was a literal 24 and the icon draws at ~20.6, so
// every checkbox row's help sat ~3.4px inboard of the submenu rows'.
describe('CascadingMenu help column', () => {
  const helpRows: MenuItem[] = [
    {
      type: 'checkbox',
      label: 'Alpha',
      checked: false,
      helpText: 'what alpha does',
      onClick: () => {},
    },
    {
      label: 'Beta',
      helpText: 'what beta is',
      subMenu: [
        { type: 'radio', label: 'One', checked: true, onClick: () => {} },
      ],
    },
  ]

  it('reserves the chevron a chevron wide, not a number wide', () => {
    const { getByTestId } = renderMenu(helpRows)
    const trailingIcon = (testid: string) => {
      const icons = getByTestId(testid).querySelectorAll('svg')
      return icons[icons.length - 1]!
    }
    const chevron = trailingIcon('cascading-submenu-beta')
    const spacer = trailingIcon('cascading-menuitem-alpha')
    expect(getComputedStyle(spacer).visibility).toBe('hidden')
    expect(getComputedStyle(spacer).fontSize).toBe(
      getComputedStyle(chevron).fontSize,
    )
    expect(getComputedStyle(spacer).width).toBe(getComputedStyle(chevron).width)
  })

  // Everything drawn to the right of a row's "?", as tag + reserved width: two
  // rows whose help sits in one column have identical footprints after it.
  const afterHelpButton = (row: HTMLElement) => {
    const help = row.querySelector('[aria-label^="Help for"]')!
    const out: string[] = []
    for (let el = help.nextElementSibling; el; el = el.nextElementSibling) {
      out.push(`${el.tagName}:${getComputedStyle(el).width}`)
    }
    return out
  }

  // The chevron reservation alone is not enough once the menu ALSO has an
  // adornment column: a clickable row put its pin in a fixed-width slot the
  // submenu row's adornment never got, so its "?" sat a whole column further in
  // — the live shape of alignments' Color by > Modifications, whose radios carry
  // help AND a pin while its submenu rows carry help.
  it('lines both row kinds up when the menu also has an adornment column', () => {
    const { getByTestId } = renderMenu([
      {
        type: 'checkbox',
        label: 'Alpha',
        checked: false,
        helpText: 'what alpha does',
        endAdornment: <span data-testid="adorn">pin</span>,
        onClick: () => {},
      },
      helpRows[1]!,
    ])
    expect(afterHelpButton(getByTestId('cascading-menuitem-alpha'))).toEqual(
      afterHelpButton(getByTestId('cascading-submenu-beta')),
    )
  })

  // Reserved only when a submenu row actually draws help: with nothing to line
  // up with, the spacer would only unalign the checkbox glyph from the chevron
  // it already sits level with.
  it('reserves nothing when no submenu row carries help', () => {
    const { getByTestId } = renderMenu([
      helpRows[0]!,
      { label: 'Beta', subMenu: [{ label: 'One', onClick: () => {} }] },
    ])
    const row = getByTestId('cascading-menuitem-alpha')
    expect(
      [...row.querySelectorAll('svg')].some(
        el => getComputedStyle(el).visibility === 'hidden',
      ),
    ).toBe(false)
  })
})

// Whether a click dismisses the menu is decided by the row TYPE, so a
// hand-written literal behaves like one built by `checkboxItem` — most of the
// repo's checkbox/radio literals never set the old opt-in flag, and each one
// shut the menu on every toggle.
describe('CascadingMenu dismissal', () => {
  it.each([
    ['checkbox' as const, false],
    ['radio' as const, false],
  ])('keeps the menu open for a bare %s literal', (type, checked) => {
    const { getByText, onClose } = renderMenu([
      { type, label: 'Alpha', checked, onClick: () => {} },
    ])
    fireEvent.click(getByText('Alpha'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('dismisses for a plain action row', () => {
    const { getByText, onClose } = renderMenu([
      { label: 'Export...', onClick: () => {} },
    ])
    fireEvent.click(getByText('Export...'))
    expect(onClose).toHaveBeenCalled()
  })

  // The override that matters: a radio whose click opens a dialog, or swaps the
  // display the rest of the menu was built from, still has to dismiss.
  it('dismisses a checkbox/radio that opts out', () => {
    const { getByText, onClose } = renderMenu([
      {
        type: 'radio',
        label: 'Custom...',
        checked: false,
        keepMenuOpen: false,
        onClick: () => {},
      },
    ])
    fireEvent.click(getByText('Custom...'))
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps an action row open when it opts in', () => {
    const { getByText, onClose } = renderMenu([
      { label: 'Bump', keepMenuOpen: true, onClick: () => {} },
    ])
    fireEvent.click(getByText('Bump'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

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
              pin: {
                slot: 'displayMode',
                onValue: 'compact',
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

// The open submenu is remembered by identity, not by position. The items are
// rebuilt on every observable change (see the pin test above), so a row
// appearing above an open submenu shifts its index — and an index-keyed flag
// would close it and open whichever submenu slid into the vacated slot.
describe('CascadingMenu submenus', () => {
  // endAdornment is declared on BaseMenuItem, which SubMenuItem extends, so the
  // type promises a submenu row can carry a control. The renderer used to drop
  // it silently, which made a per-track color swatch in a "Per track >" list
  // invisible with no type error to catch it.
  it('renders an endAdornment on a submenu row without opening the submenu', () => {
    const onSwatch = jest.fn()
    const { getByText, getByTestId } = render(
      <ThemeProvider theme={theme}>
        <CascadingMenu
          open
          menuItems={() => [
            {
              label: 'Per track',
              endAdornment: (
                <span
                  data-testid="swatch"
                  onClick={event => {
                    event.stopPropagation()
                    onSwatch()
                  }}
                >
                  swatch
                </span>
              ),
              subMenu: [{ label: 'Inner', onClick: () => {} }],
            },
          ]}
          onMenuItemClick={cb => {
            cb()
          }}
          onClose={() => {}}
        />
      </ThemeProvider>,
    )
    expect(getByText('swatch')).toBeTruthy()

    fireEvent.click(getByTestId('swatch'))
    expect(onSwatch).toHaveBeenCalled()
    // the swatch stopped propagation, so the row did not open
    expect(
      getByTestId('cascading-submenu-per_track').getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('keeps the same submenu open when a row appears above it', () => {
    const showExtra = observable.box(false)
    const { getByText, getByTestId } = render(
      <ThemeProvider theme={theme}>
        <CascadingMenu
          open
          menuItems={() => [
            ...(showExtra.get() ? [{ label: 'Extra', onClick: () => {} }] : []),
            { label: 'Colors', subMenu: [{ label: 'Red', onClick: () => {} }] },
            {
              label: 'Shapes',
              subMenu: [{ label: 'Square', onClick: () => {} }],
            },
          ]}
          onMenuItemClick={cb => {
            cb()
          }}
          onClose={() => {}}
        />
      </ThemeProvider>,
    )
    // aria-expanded rather than the panel contents: a closing MUI Menu stays
    // mounted through its exit transition, so its rows outlive the state change
    const expanded = (label: string) =>
      getByTestId(`cascading-submenu-${label}`).getAttribute('aria-expanded')

    fireEvent.mouseOver(getByText('Colors'))
    expect(getByText('Red')).toBeTruthy()
    expect([expanded('colors'), expanded('shapes')]).toEqual(['true', 'false'])

    act(() => {
      runInAction(() => {
        showExtra.set(true)
      })
    })
    expect([expanded('colors'), expanded('shapes')]).toEqual(['true', 'false'])
  })
})

// The pointer's trip from a submenu row to the panel it opened crosses the rows
// below it, and every one of those rows wants the panel closed. Acting on the
// first one made the diagonal unwalkable: the panel vanished the instant the
// pointer strayed off the parent row, which is most of the way to it.
describe('CascadingMenu submenu hover intent', () => {
  const items: MenuItem[] = [
    { label: 'Colors', subMenu: [{ label: 'Red', onClick: () => {} }] },
    { label: 'Beta', onClick: () => {} },
    { label: 'Gamma', onClick: () => {} },
    { label: 'Shapes', subMenu: [{ label: 'Square', onClick: () => {} }] },
  ]

  // aria-expanded rather than the panel contents: a closing MUI Menu stays
  // mounted through its exit transition, so its rows outlive the state change
  const expandedIn =
    (getByTestId: (id: string) => HTMLElement) => (label: string) =>
      getByTestId(`cascading-submenu-${label}`).getAttribute('aria-expanded')

  const settle = () => {
    act(() => {
      jest.advanceTimersByTime(1000)
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('opens the first panel with no delay', () => {
    const { getByText, getByTestId } = renderMenu(items)
    fireEvent.mouseOver(getByText('Colors'))
    expect(expandedIn(getByTestId)('colors')).toBe('true')
  })

  it('survives a pointer that only passes over a sibling row', () => {
    const { getByText, getByTestId } = renderMenu(items)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.mouseOver(getByText('Beta'))
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(expandedIn(getByTestId)('colors')).toBe('true')
  })

  it('closes once the pointer settles on a sibling row', () => {
    const { getByText, getByTestId } = renderMenu(items)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.mouseOver(getByText('Beta'))
    settle()
    expect(expandedIn(getByTestId)('colors')).toBe('false')
  })

  // The panel is the destination, so arriving there is what proves the rows
  // crossed on the way were incidental. Its paper carries the hover, not the
  // click-through root the submenu's Menu spans the viewport with.
  it('cancels the pending close once the pointer reaches the panel', () => {
    const { getByText, getByTestId } = renderMenu(items)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.mouseOver(getByText('Beta'))
    fireEvent.mouseOver(getByText('Red'))
    settle()
    expect(expandedIn(getByTestId)('colors')).toBe('true')
  })

  // What a browser actually sends when the pointer crosses from the list into
  // the panel: a mouseout on the row it left, naming the panel as relatedTarget.
  // React derives the enter from THAT, walking the fiber tree to the two nodes'
  // common ancestor — the mouseover above takes a different branch of the same
  // plugin, so it alone would not prove the handler is reachable across the
  // portal boundary.
  it('cancels it on the event a pointer crossing portals really sends', () => {
    const { getByText, getByTestId } = renderMenu(items)
    fireEvent.mouseOver(getByText('Colors'))
    const beta = getByTestId('cascading-menuitem-beta')
    fireEvent.mouseOver(beta)
    fireEvent.mouseOut(beta, { relatedTarget: getByText('Red') })
    settle()
    expect(expandedIn(getByTestId)('colors')).toBe('true')
  })

  // The deadline belongs to the pending change, not to the row that asked for
  // it: restarting the timer per row means a pointer sliding down a long list
  // never closes the panel at all, which is the naive way to write the delay.
  it('does not restart the delay on each further row crossed', () => {
    const { getByText, getByTestId } = renderMenu(items)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.mouseOver(getByText('Beta'))
    act(() => {
      jest.advanceTimersByTime(200)
    })
    fireEvent.mouseOver(getByText('Gamma'))
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(expandedIn(getByTestId)('colors')).toBe('false')
  })

  it('waits before letting another submenu row take over', () => {
    const { getByText, getByTestId } = renderMenu(items)
    const expanded = expandedIn(getByTestId)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.mouseOver(getByText('Shapes'))
    expect([expanded('colors'), expanded('shapes')]).toEqual(['true', 'false'])
    settle()
    expect([expanded('colors'), expanded('shapes')]).toEqual(['false', 'true'])
  })

  // A click and an ArrowRight say where the pointer meant to go, so neither
  // waits to be sure of it.
  it('switches at once on a click', () => {
    const { getByText, getByTestId } = renderMenu(items)
    const expanded = expandedIn(getByTestId)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.click(getByText('Shapes'))
    expect([expanded('colors'), expanded('shapes')]).toEqual(['false', 'true'])
  })

  it('switches at once on ArrowRight', () => {
    const { getByText, getByTestId } = renderMenu(items)
    const expanded = expandedIn(getByTestId)
    fireEvent.mouseOver(getByText('Colors'))
    fireEvent.keyDown(getByTestId('cascading-submenu-shapes'), {
      key: 'ArrowRight',
    })
    expect([expanded('colors'), expanded('shapes')]).toEqual(['false', 'true'])
  })
})
