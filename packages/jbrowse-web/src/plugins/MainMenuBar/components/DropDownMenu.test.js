import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import { MainMenuBarModel } from '../model'
import DropDownMenu from './DropDownMenu'

describe('<DropDownMenu />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const menubar = MainMenuBarModel.create({
      id: 'testingId',
      type: 'MainMenuBar',
    })
    const menu = menubar.menus[0]
    const wrapper = shallow(
      <DropDownMenu
        model={menubar}
        menuTitle={menu.name}
        menuItems={menu.menuItems}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('opens and closes a menu and selects a menu item', () => {
    const menubar = MainMenuBarModel.create({
      id: 'testingId',
      type: 'MainMenuBar',
    })
    const menu = menubar.menus[0]
    const wrapper = shallow(
      <DropDownMenu
        model={menubar}
        menuTitle={menu.name}
        menuItems={menu.menuItems}
      />,
    )
      .first()
      .shallow()
    const instance = wrapper.instance()
    const helpButton = wrapper.find('WithStyles(Button)')
    // Click menu button to open
    instance.handleToggle({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu button again to close (two events, one for menu click and one for ClickAwayListener)
    instance.handleClose({ target: 'Help' })
    expect(wrapper).toMatchSnapshot()
    instance.handleToggle({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu button to open
    instance.handleToggle({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click somewhere else on page to close with ClickAwayListener
    instance.handleClose({ target: 'somewhereElseOnPage' })
    expect(wrapper).toMatchSnapshot()
  })

  it('selects a menu item', () => {
    const menubar = MainMenuBarModel.create({
      id: 'testingId',
      type: 'MainMenuBar',
    })
    const menu = menubar.menus[0]
    const wrapper = shallow(
      <DropDownMenu
        model={menubar}
        menuTitle={menu.name}
        menuItems={menu.menuItems}
      />,
    )
      .first()
      .shallow()
    const instance = wrapper.instance()
    const helpButton = wrapper.find('WithStyles(Button)')
    const callback = jest.fn(() => {})
    // Click menu button to open
    instance.handleToggle({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu item to close and activate callback
    instance.handleClose({ target: 'someMenuItem' }, callback)
    expect(wrapper).toMatchSnapshot()
    expect(callback.mock.calls.length).toBe(1)
  })
})
