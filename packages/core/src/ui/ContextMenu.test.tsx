import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import ContextMenu from './ContextMenu.tsx'
import { createJBrowseTheme } from './theme.ts'
import { CONTEXT_MENU_Z_INDEX } from './zIndexes.ts'

import type { MenuItem } from './MenuTypes.ts'

function renderMenu(props: React.ComponentProps<typeof ContextMenu>) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ContextMenu {...props} />
    </ThemeProvider>,
  )
}

const ITEMS: MenuItem[] = [{ label: 'Do a thing', onClick: () => {} }]

test('renders nothing without an anchor', () => {
  const { container } = renderMenu({
    anchor: undefined,
    menuItems: ITEMS,
    onClose: () => {},
  })
  expect(container.textContent).toBe('')
})

// MUI keeps a Paper that fades out on close, so anchoring an empty menu flashes
// an empty box at the cursor. Displays that build items from a hit can produce
// an empty list, so the gate lives here rather than at each call site.
test('renders nothing when the item list is empty', () => {
  const { container } = renderMenu({
    anchor: { clientX: 10, clientY: 20 },
    menuItems: [],
    onClose: () => {},
  })
  expect(container.textContent).toBe('')
})

// The getter is resolved here, not by the caller, so a display can hand over
// `() => model.contextMenuItems()` and have it run only while the menu is up.
test('does not resolve the item getter while closed', () => {
  const menuItems = jest.fn(() => ITEMS)
  renderMenu({ anchor: undefined, menuItems, onClose: () => {} })
  expect(menuItems).not.toHaveBeenCalled()
})

// Clicking an item closes exactly once: CascadingMenu's closeAfterItemClick
// default fires onClose ahead of the callback, so no call site should add a
// second close of its own.
test('closes once on an item click, before the callback runs', () => {
  const order: string[] = []
  const { getByText } = renderMenu({
    anchor: { clientX: 10, clientY: 20 },
    menuItems: [
      {
        label: 'Do a thing',
        onClick: () => {
          order.push('callback')
        },
      },
    ],
    onClose: () => {
      order.push('close')
    },
  })

  fireEvent.click(getByText('Do a thing'))
  expect(order).toEqual(['close', 'callback'])
})

// Every level is its own portal, and this menu's root is raised off Material
// UI's modal scale to clear the tooltip layer. A submenu left on that default
// scale drew in the right place and did nothing: it sat under the root's
// viewport-spanning modal, whose backdrop took the hovers and clicks meant for
// its rows. jsdom computes no stacking, so the levels are asserted equal.
test('a submenu stacks at the level its root menu was raised to', () => {
  const { getByText } = renderMenu({
    anchor: { clientX: 10, clientY: 20 },
    menuItems: [
      {
        label: 'Show/hide',
        subMenu: [{ label: 'Pin to top', onClick: () => {} }],
      },
    ],
    onClose: () => {},
  })

  fireEvent.mouseOver(getByText('Show/hide'))
  expect(getByText('Pin to top')).toBeTruthy()

  const levels = [...document.querySelectorAll<HTMLElement>('.MuiPopover-root')]
  expect(levels.map(el => el.style.zIndex)).toEqual([
    `${CONTEXT_MENU_Z_INDEX}`,
    `${CONTEXT_MENU_Z_INDEX}`,
  ])
  // the submenu root stays click-through, so the gap between the opener row and
  // the panel doesn't swallow a pointer crossing into it
  expect(levels[1]!.style.pointerEvents).toBe('none')
})
