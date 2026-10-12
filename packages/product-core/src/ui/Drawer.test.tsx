import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import Drawer from './Drawer.tsx'

import type { DrawerChromeSession } from './Drawer.tsx'

function stubSession(
  overrides: Partial<DrawerChromeSession> = {},
): DrawerChromeSession {
  return {
    drawerPosition: 'right',
    resizeDrawer: jest.fn(() => 0),
    ...overrides,
  }
}

// the drawer is a grid item, so it is rendered inside a host box the way a
// product mounts it rather than straight into the test container
function renderDrawer(session: DrawerChromeSession) {
  const { container } = render(
    <div style={{ display: 'grid', width: 900 }}>
      <ThemeProvider theme={createJBrowseTheme()}>
        <Drawer session={session}>
          <div>widget</div>
        </Drawer>
      </ThemeProvider>
    </div>,
  )
  const [root] = container.firstElementChild?.children ?? []
  if (!root) {
    throw new Error('drawer did not render')
  }
  const [paper, handle] = root.children
  if (paper !== screen.getByTestId('drawer-widget')) {
    throw new Error('the paper is no longer the first of the drawer two boxes')
  }
  return { root, handle }
}

test('the handle sits beside the paper, not over it', () => {
  const { root, handle } = renderDrawer(stubSession())
  expect(window.getComputedStyle(root).display).toBe('flex')
  expect(window.getComputedStyle(handle!).position).not.toBe('absolute')
})

test('a right drawer puts the handle first', () => {
  const { handle } = renderDrawer(stubSession())
  expect(window.getComputedStyle(handle!).order).toBe('-1')
})

test('a left drawer puts the handle last', () => {
  const { handle } = renderDrawer(stubSession({ drawerPosition: 'left' }))
  expect(window.getComputedStyle(handle!).order).toBe('1')
})

// The drawer takes its grid column by name, so a host renders it once rather
// than once per side under opposite conditions.
test('the drawer places itself in the named grid column', () => {
  const { root } = renderDrawer(stubSession())
  expect(window.getComputedStyle(root).gridColumn).toBe('drawer')
})

test('the drawer takes the last row, so a left drawer does not drop below the main item', () => {
  const { root } = renderDrawer(stubSession({ drawerPosition: 'left' }))
  expect(window.getComputedStyle(root).gridRow).toBe('-2/-1')
})

// `window.innerWidth` is the drawer's container only in a full-window app.
test('a drag clamps against the grid the drawer is an item of', () => {
  const resizeDrawer = jest.fn(() => 0)
  const { handle } = renderDrawer(stubSession({ resizeDrawer }))
  fireEvent.pointerDown(handle!, { clientX: 100, pointerId: 1 })
  fireEvent.pointerMove(handle!, { clientX: 80, pointerId: 1 })
  fireEvent.pointerUp(handle!, { clientX: 80, pointerId: 1 })
  expect(resizeDrawer).toHaveBeenCalledWith(-20, expect.any(Number))
})
