import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import DropDownMenu from './DropDownMenu'

describe('<DropDownMenu />', () => {
  let session

  beforeAll(() => {
    session = createTestSession({
      rpc: { defaultDriver: 'MainThreadRpcDriver' },
    })
    // @ts-ignore
    session.menuBars[0].unshiftMenu({
      name: 'Test Menu',
      menuItems: [
        {
          name: 'Test Item',
          icon: 'info',
          callback: 'function(session){session.updateDrawerWidth(200)}',
        },
      ],
    })
  })

  afterEach(cleanup)

  it('renders', () => {
    const [menu] = session.menuBars[0].menus
    const { container } = render(
      <DropDownMenu
        menuTitle={menu.name}
        menuItems={menu.menuItems}
        session={session}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('opens a menu and selects a menu item', async () => {
    const [menu] = session.menuBars[0].menus
    const { getByTestId } = render(
      <DropDownMenu
        menuTitle={menu.name}
        menuItems={menu.menuItems}
        session={session}
      />,
    )
    fireEvent.click(getByTestId('dropDownMenuButton'))
    const aboutMenuItem = getByTestId('menuItemId')
    expect(aboutMenuItem).toMatchSnapshot()
    session.updateDrawerWidth(256)
    expect(session.drawerWidth).toBe(256)
    fireEvent.click(aboutMenuItem)
    expect(session.drawerWidth).toBe(200)
  })
})
