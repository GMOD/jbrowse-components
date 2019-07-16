import { createTestSession } from '@gmod/jbrowse-web/src/jbrowseModel'
import React from 'react'
import { render } from 'react-testing-library'
import MainMenuBar from './MainMenuBar'

describe('<MainMenuBar />', () => {
  it('renders', () => {
    const session = createTestSession({
      defaultSession: { menuBars: [{ id: 'testing', type: 'MainMenuBar' }] },
    })
    const model = session.menuBars[0]
    const { container } = render(<MainMenuBar model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
