import React from 'react'
import { createTestSession } from '@jbrowse/web/src/rootModel'

import { render } from '@testing-library/react'
import SessionManager from './SessionManager'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

describe('<SessionManager />', () => {
  it('renders', () => {
    const session = createTestSession()
    const { container } = render(<SessionManager session={session} />)
    expect(container).toMatchSnapshot()
  })
})
