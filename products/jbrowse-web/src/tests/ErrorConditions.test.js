import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { JBrowse, getPluginManager, generateReadBuffer } from './util'

import { render } from '@testing-library/react'
import chromeSizesConfig from '../../test_data/config_chrom_sizes_test.json'

const waitForOptions = { timeout: 15000 }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

// eslint-disable-next-line react/prop-types
function FallbackComponent({ error }) {
  return <div>there was an error: {String(error)}</div>
}

test('404 sequence file', async () => {
  console.error = jest.fn()
  const pluginManager = getPluginManager(chromeSizesConfig)
  const { findAllByText } = render(
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <JBrowse pluginManager={pluginManager} />
    </ErrorBoundary>,
  )
  await findAllByText('HTTP 404 fetching grape.chrom.sizes.nonexist', {
    exact: false,
  })
})

test('wrong assembly', async () => {
  console.error = jest.fn()
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findAllByText } = render(<JBrowse pluginManager={pluginManager} />)
  const view = state.session.views[0]
  view.showTrack('volvox_wrong_assembly')
  await findAllByText(
    'Error: region assembly (volvox) does not match track assemblies (wombat)',
    {},
    waitForOptions,
  )
}, 15000)
