import React from 'react'
import renderer from 'react-test-renderer'
import AppBar from './AppBar'
import appBarModel from './appBarModel'

describe('app bar', () => {
  it('renders with no menus', () => {
    const model = appBarModel.create({ type: 'appbar' })
    const tree = renderer.create(<AppBar model={model} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders with no menus', () => {
    const model = appBarModel.create({ type: 'appbar' })
    const tree = renderer.create(<AppBar model={model} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders one menu with two menu items', () => {
    const model = appBarModel.create({
      type: 'appbar',
      menus: [
        {
          name: 'FirstMenu',
          menuItems: [{ name: 'FirstMenuItem1' }],
        },
      ],
    })
    const tree = renderer.create(<AppBar model={model} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders two menu with two menu items each', () => {
    const model = appBarModel.create({
      type: 'appbar',
      menus: [
        {
          name: 'FirstMenu',
          menuItems: [{ name: 'FirstMenuItem' }, { name: 'SecondMenuItem' }],
        },
        {
          name: 'SecondMenu',
          menuItems: [
            { name: 'FirstMenuItem', icon: 'bookmark' },
            { name: 'SecondMenuItem', icon: 'search' },
          ],
        },
      ],
    })
    const tree = renderer.create(<AppBar model={model} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
