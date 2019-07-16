import React from 'react'
import { render } from 'react-testing-library'
import AboutDrawerWidget from './AboutDrawerWidget'

describe('<AboutDrawerWidget />', () => {
  it('renders', () => {
    const { container } = render(<AboutDrawerWidget />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
