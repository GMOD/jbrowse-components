import React from 'react'
import { cleanup, fireEvent, render } from 'react-testing-library'
import { createTestEnv } from '../../../JBrowse'
import DropDownMenu from './DropDownMenu'

jest.mock('popper.js', () => {
  const PopperJS = jest.requireActual('popper.js')
  return class Popper {
    static placements = PopperJS.placements

    constructor() {
      return {
        destroy: () => {},
        scheduleUpdate: () => {},
      }
    }
  }
})

describe('<DropDownMenu />', () => {
  let rootModel

  beforeAll(async () => {
    ;({ rootModel } = await createTestEnv({
      configId: 'testing',
      rpc: { defaultDriver: 'MainThreadRpcDriver' },
    }))
    rootModel.menuBars[0].unshiftMenu({
      name: 'Test Menu',
      menuItems: [
        {
          name: 'Test Item',
          icon: 'info',
          callback: 'function(rootModel){rootModel.updateDrawerWidth(200)}',
        },
      ],
    })
  })

  afterEach(cleanup)

  it('renders', () => {
    const [menu] = rootModel.menuBars[0].menus
    const { container } = render(
      <DropDownMenu
        menuTitle={menu.name}
        menuItems={menu.menuItems}
        rootModel={rootModel}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('opens a menu and selects a menu item', async () => {
    const [menu] = rootModel.menuBars[0].menus
    const { getByTestId } = render(
      <DropDownMenu
        menuTitle={menu.name}
        menuItems={menu.menuItems}
        rootModel={rootModel}
      />,
    )
    fireEvent.click(getByTestId('dropDownMenuButton'))
    const aboutMenuItem = getByTestId('menuItemId')
    expect(aboutMenuItem).toMatchSnapshot()
    rootModel.updateDrawerWidth(256)
    expect(rootModel.drawerWidth).toBe(256)
    fireEvent.click(aboutMenuItem)
    expect(rootModel.drawerWidth).toBe(200)
  })
})
