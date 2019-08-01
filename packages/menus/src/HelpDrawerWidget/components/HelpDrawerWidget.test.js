import React from 'react'
import { render } from 'react-testing-library'
import HelpDrawerWidget from './HelpDrawerWidget'

describe('<HelpDrawerWidget />', () => {
  it('renders', () => {
    const { container } = render(<HelpDrawerWidget />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
