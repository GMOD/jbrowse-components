import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'

import PluginStoreWidget from './PluginStoreWidget'

describe('<PluginStoreWidget />', () => {
  let session
  let model

  beforeAll(() => {
    session = createTestSession()
    model = session.addWidget('PluginStoreWidget', 'pluginStoreWidget')
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<PluginStoreWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
