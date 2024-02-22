import React from 'react'
import { render } from '@testing-library/react'
import HelpWidget from './HelpWidget'

describe('<HelpWidget />', () => {
  it('renders', () => {
    const { container } = render(<HelpWidget />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
