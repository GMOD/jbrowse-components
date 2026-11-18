import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import DrawerWidget from './DrawerWidget.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(cleanup)

function setup() {
  const session = createTestSession()
  const widgetView = session.addView('LinearGenomeView', {})
  const otherView = session.addView('LinearGenomeView', {})
  session.showWidget(
    session.addWidget('HierarchicalTrackSelectorWidget', 'hts', {
      view: widgetView.id,
    }),
  )
  session.setFocusedViewId(otherView.id)
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DrawerWidget session={session} />
    </ThemeProvider>,
  )
  return { ...utils, session, widgetView }
}

test('the app drawer has the pop-out button beside the shared controls', () => {
  const { getByTestId } = setup()
  expect(getByTestId('drawer-popout')).toBeTruthy()
  expect(getByTestId('drawer-minimize')).toBeTruthy()
})

test('a click in the drawer focuses the view its widget belongs to', () => {
  const { getByTestId, session, widgetView } = setup()
  expect(session.focusedViewId).not.toBe(widgetView.id)

  fireEvent.mouseDown(getByTestId('widget-drawer-selects'))

  expect(session.focusedViewId).toBe(widgetView.id)
})

test('the drawer header is tinted until the view its widget belongs to has focus', () => {
  const { container, session, widgetView } = setup()
  const header = container.querySelector('header')
  const unfocused = header?.className

  act(() => {
    session.setFocusedViewId(widgetView.id)
  })

  expect(unfocused).toBeTruthy()
  expect(header?.className).not.toBe(unfocused)
})
