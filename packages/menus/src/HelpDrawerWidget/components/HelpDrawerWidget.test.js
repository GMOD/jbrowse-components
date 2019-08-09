import React from 'react'
import { render } from '@testing-library/react'
import HelpDrawerWidget from './HelpDrawerWidget'

describe('<HelpDrawerWidget />', () => {
  it('renders', () => {
    const { container } = render(<HelpDrawerWidget />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
