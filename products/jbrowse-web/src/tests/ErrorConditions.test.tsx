/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react'
import { render } from '@testing-library/react'
import { ErrorBoundary } from 'react-error-boundary'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { JBrowse, getPluginManager, generateReadBuffer } from './util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import chromeSizesConfig from '../../test_data/config_chrom_sizes_test.json'

type LGV = LinearGenomeViewModel

const delay = { timeout: 15000 }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

function FallbackComponent({ error }: { error: unknown }) {
  return <div>there was an error: {String(error)}</div>
}

test('404 sequence file', async () => {
  console.error = jest.fn()
  const pm = getPluginManager(chromeSizesConfig)
  const { findAllByText } = render(
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <JBrowse pluginManager={pm} />
    </ErrorBoundary>,
  )
  await findAllByText('HTTP 404 fetching grape.chrom.sizes.nonexist', {
    exact: false,
  })
})

test('wrong assembly', async () => {
  console.error = jest.fn()
  const pm = getPluginManager()
  const { findAllByText } = render(<JBrowse pluginManager={pm} />)
  const state = pm.rootModel!
  const session = state.session!
  const view = session.views[0] as LGV
  view.showTrack('volvox_wrong_assembly')
  await findAllByText(
    'Error: region assembly (volvox) does not match track assemblies (wombat)',
    {},
    delay,
  )
}, 15000)
