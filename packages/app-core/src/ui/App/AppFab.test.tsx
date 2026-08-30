import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, within } from '@testing-library/react'

import AppFab from './AppFab.tsx'

import type { AppFabSession } from './AppFab.tsx'

function stubSession(overrides: Partial<AppFabSession> = {}): AppFabSession {
  return {
    minimized: true,
    activeWidgets: { size: 1 },
    drawerPosition: 'right',
    showWidgetDrawer: jest.fn(),
    ...overrides,
  }
}

// scoped to its own container rather than `screen`, since one test below
// renders two fabs and RTL's bound queries still search the whole body
function renderFab(session: AppFabSession) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AppFab session={session} />
    </ThemeProvider>,
  )
  return within(container).queryByTestId('drawer-maximize')
}

// `fixed` measures against the window, and the app root is the window only in a
// full-window app: under `--jbrowse-app-height` this was pinned to the host
// page's corner rather than the app's, and it is the only way back from a
// minimized drawer.
test('the fab floats over the app root, not the page', () => {
  const fab = renderFab(stubSession())
  expect(window.getComputedStyle(fab!).position).toBe('absolute')
})

test('the fab sits on the side the drawer will come back on', () => {
  expect(window.getComputedStyle(renderFab(stubSession())!).right).not.toBe('')
  const left = renderFab(stubSession({ drawerPosition: 'left' }))
  expect(window.getComputedStyle(left!).left).not.toBe('')
  expect(window.getComputedStyle(left!).right).toBe('')
})

test('nothing to restore, no fab', () => {
  expect(renderFab(stubSession({ minimized: false }))).toBeNull()
  expect(renderFab(stubSession({ activeWidgets: { size: 0 } }))).toBeNull()
})
