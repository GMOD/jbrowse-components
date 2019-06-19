import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import MainMenuBar from './MainMenuBar'

jest.mock('shortid', () => ({ generate: () => 'testid' }))

describe('<MainMenuBar />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', async () => {
    const { rootModel } = await createTestEnv({
      defaultSession: { menuBars: [{ id: 'testing', type: 'MainMenuBar' }] },
    })
    const model = rootModel.menuBars[0]
    const wrapper = shallow(<MainMenuBar model={model} />)
      .first()
      .shallow()
    expect(wrapper).toMatchSnapshot()
  })
})
