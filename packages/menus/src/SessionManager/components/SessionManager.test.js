import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import React from 'react'
import { render } from 'react-testing-library'
import SessionManager from './SessionManager'

describe('<SessionManager />', () => {
  it('renders', () => {
    const session = createTestSession()
    const { container } = render(<SessionManager session={session} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
