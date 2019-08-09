import React from 'react'
import { render } from '@testing-library/react'
import AboutDrawerWidget from './AboutDrawerWidget'

describe('<AboutDrawerWidget />', () => {
  it('renders', () => {
    const { container } = render(<AboutDrawerWidget />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
