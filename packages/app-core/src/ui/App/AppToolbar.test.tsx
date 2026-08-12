import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import AppToolbar from './AppToolbar.tsx'

import type { AppSession, Menu } from './types.ts'

afterEach(cleanup)

const theme = createJBrowseTheme()
const configuration = ConfigurationSchema('Root', {}).create()

function renderToolbar(menus: Menu[]) {
  const session = {
    name: 'session',
    configuration,
    menus: () => menus,
    renameCurrentSession: () => {},
  } as unknown as AppSession
  const utils = render(
    <ThemeProvider theme={theme}>
      <AppToolbar session={session} />
    </ThemeProvider>,
  )
  return { ...utils, session }
}

// A root model's menu items are written as `onClick: session => …` — the app
// bar is the only thing that knows which session they belong to, and the
// renderer invokes onClick itself. Nothing else in the repo passes an argument
// through that seam, so it is only this test that says the argument arrives.
describe('AppToolbar passes the session to a menu item', () => {
  it('at the top level', () => {
    const onClick = jest.fn()
    const { getByText, session } = renderToolbar([
      { label: 'Add', menuItems: () => [{ label: 'Linear view', onClick }] },
    ])
    fireEvent.click(getByText('Add'))
    fireEvent.click(getByText('Linear view'))
    expect(onClick).toHaveBeenCalledWith(session)
  })

  it('inside a sub-menu', () => {
    const onClick = jest.fn()
    const { getByText, session } = renderToolbar([
      {
        label: 'Add',
        menuItems: () => [
          { label: 'More', subMenu: [{ label: 'Dotplot view', onClick }] },
        ],
      },
    ])
    fireEvent.click(getByText('Add'))
    fireEvent.mouseOver(getByText('More'))
    fireEvent.click(getByText('Dotplot view'))
    expect(onClick).toHaveBeenCalledWith(session)
  })
})
