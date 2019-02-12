import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import { MainMenuBarModel } from '../model'
import MainMenuBar from './MainMenuBar'

describe('<MainMenuBar />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const menubar = MainMenuBarModel.create({
      id: 'testingId',
      type: 'MainMenuBar',
    })
    const wrapper = shallow(
      <MainMenuBar
        model={menubar}
        rootModel={{ activeDrawerWidgets: new Map() }}
      />,
    )
      .first()
      .shallow()
    expect(wrapper).toMatchSnapshot()
  })
})
