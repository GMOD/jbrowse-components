import { createTestSession } from '@gmod/jbrowse-web/src/jbrowseModel'
import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import MainMenuBar from './MainMenuBar'

jest.mock('shortid', () => ({ generate: () => 'testid' }))

describe('<MainMenuBar />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const session = createTestSession({
      defaultSession: { menuBars: [{ id: 'testing', type: 'MainMenuBar' }] },
    })
    const model = session.menuBars[0]
    const wrapper = shallow(<MainMenuBar model={model} />)
      .first()
      .shallow()
    expect(wrapper).toMatchSnapshot()
  })
})
