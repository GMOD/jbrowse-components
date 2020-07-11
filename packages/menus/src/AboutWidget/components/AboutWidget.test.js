import React from 'react'
import { render } from '@testing-library/react'
import AboutWidget from './AboutWidget'

describe('<AboutWidget />', () => {
  it('renders', () => {
    const { container } = render(<AboutWidget />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
