import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import breakpointConfig from '../../test_data/breakpoint/config.json'
import { createView, setup, generateReadBuffer } from './util'

setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/breakpoint/${url}`))
    }),
  )
})

const delay = { timeout: 10000 }

test('breakpoint split view', async () => {
  console.warn = jest.fn()
  const { findByTestId, queryAllByTestId } = createView(breakpointConfig)
  // the breakpoint could be partially loaded so explicitly wait for two items
  await waitFor(() => expect(queryAllByTestId('r1').length).toBe(2), delay)

  expect(
    await findByTestId('pacbio_hg002_breakpoints-loaded'),
  ).toMatchSnapshot()

  expect(await findByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
}, 10000)
