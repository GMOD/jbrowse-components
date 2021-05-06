import React from 'react'
import {
  render,
  cleanup,
  // fireEvent,
  // waitFor,
  // screen,
} from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'

import PluginStoreWidget from './PluginStoreWidget'

const plugins = {
  plugins: [
    {
      name: 'MsaView',
      authors: ['Colin Diesh'],
      description: 'multiple sequence alignment browser plugin for JBrowse 2',
      location: 'https://github.com/GMOD/jbrowse-plugin-msaview',
      url:
        'https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js',
      license: 'Apache License 2.0',
      image:
        'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/msaview-screenshot-fs8.png',
    },
    {
      name: 'GDC',
      authors: ['Garrett Stevens', 'Colin Diesh', 'Rob Buels'],
      description: 'JBrowse 2 plugin for integrating with GDC resources',
      location: 'https://github.com/GMOD/jbrowse-plugin-gdc',
      url:
        'https://unpkg.com/jbrowse-plugin-gdc/dist/jbrowse-plugin-gdc.umd.production.min.js',
      license: 'MIT',
      image:
        'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/gdc-screenshot-fs8.png',
    },
  ],
}

describe('<PluginStoreWidget />', () => {
  let session
  let model

  beforeAll(() => {
    session = createTestSession()
    model = session.addWidget('PluginStoreWidget', 'pluginStoreWidget')
  })

  beforeEach(() => {
    fetch.resetMocks()
  })

  afterEach(cleanup)

  it('renders with the available plugins', async () => {
    fetch.mockResponse(JSON.stringify(plugins))
    const { container, findByText } = render(
      <PluginStoreWidget model={model} />,
    )
    await findByText('multiple sequence alignment browser plugin for JBrowse 2')
    expect(container.firstChild).toMatchSnapshot()
  })
})
