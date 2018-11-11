import React from 'react'
import renderer from 'react-test-renderer'
import { Provider } from 'mobx-react'
import { types } from 'mobx-state-tree'
import AppBar from './AppBar'
import appBarModel from './appBarModel'

describe('app bar', () => {
  it('renders with no menus', () => {
    const model = appBarModel.create({ type: 'appbar' })
    const tree = renderer.create(<AppBar model={model} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders one menu with one menu item', () => {
    const rootModel = types.model('testModel').create()
    const model = appBarModel.create({
      type: 'appbar',
      menus: [
        {
          name: 'FirstMenu',
          menuItems: [
            {
              name: 'FirstMenuItem1',
              callback: 'function(model){console.log(model)}',
            },
          ],
        },
      ],
    })
    const tree = renderer
      .create(
        <Provider rootModel={rootModel}>
          <AppBar model={model} />
        </Provider>,
      )
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders two menus with two menu items each', () => {
    const rootModel = types.model('testModel').create()
    const model = appBarModel.create({
      type: 'appbar',
      menus: [
        {
          name: 'FirstMenu',
          menuItems: [
            {
              name: 'FirstMenuItem',
              callback: 'function(model){console.log(model)}',
            },
            {
              name: 'SecondMenuItem',
              callback: 'function(model){console.log(model)}',
            },
          ],
        },
        {
          name: 'SecondMenu',
          menuItems: [
            {
              name: 'FirstMenuItem',
              callback: 'function(model){console.log(model)}',
              icon: 'bookmark',
            },
            {
              name: 'SecondMenuItem',
              callback: 'function(model){console.log(model)}',
              icon: 'search',
            },
          ],
        },
      ],
    })
    const tree = renderer
      .create(
        <Provider rootModel={rootModel}>
          <AppBar model={model} />
        </Provider>,
      )
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
