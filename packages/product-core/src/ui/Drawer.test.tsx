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

// The handle used to be `position: fixed`, which measures against the window
// rather than the drawer: in an embedded view -- a box the host sized, sitting
// anywhere on a page -- that was a page-tall col-resize strip, and a left-hand
// drawer's `left: drawerWidth` was measured from the page's edge instead of the
// embed's.
test('the resize handle is positioned against the drawer, not the window', () => {
  const { handle } = renderDrawer(stubSession())
  const style = window.getComputedStyle(handle!)
  expect(style.position).toBe('absolute')
  expect(style.left).toBe('0px')
})

test('the handle takes the edge facing the main content', () => {
  const { handle } = renderDrawer(stubSession({ drawerPosition: 'left' }))
  const style = window.getComputedStyle(handle!)
  expect(style.right).toBe('0px')
  expect(style.left).toBe('')
})

// The drawer takes its grid column by name, so a host renders it once rather
// than once per side under opposite conditions.
test('the drawer places itself in the named grid column', () => {
  const { root } = renderDrawer(stubSession())
  expect(window.getComputedStyle(root).gridColumn).toBe('drawer')
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
