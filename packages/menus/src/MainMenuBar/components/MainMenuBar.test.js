import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import { createMuiTheme } from '@material-ui/core/styles'
import { ThemeProvider } from '@material-ui/styles'
import { render } from '@testing-library/react'
import React from 'react'
import MainMenuBar from './MainMenuBar'

describe('<MainMenuBar />', () => {
  it('renders', () => {
    /** @type any */
    const session = createTestSession({
      defaultSession: { menuBars: [{ id: 'testing', type: 'MainMenuBar' }] },
    })
    const model = session.menuBars[0]
    const { container } = render(
      <ThemeProvider theme={createMuiTheme()}>
        <MainMenuBar model={model} />
      </ThemeProvider>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
