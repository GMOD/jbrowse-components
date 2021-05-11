// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, render, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import breakpointConfig from '../../test_data/breakpoint/config.json'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, generateReadBuffer } from './util'

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/breakpoint/${url}`))
    }),
  )
})

describe('breakpoint split view', () => {
  it('open a split view', async () => {
    console.warn = jest.fn()
    const pluginManager = getPluginManager(breakpointConfig)
    const { findByTestId, queryAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await waitFor(
      () => {
        const r = queryAllByTestId('r1')
        expect(r.length).toBe(2)
      },
      { timeout: 10000 },
    ) // the breakpoint could be partially loaded so explicitly wait for two items
    expect(
      await findByTestId('pacbio_hg002_breakpoints-loaded'),
    ).toMatchSnapshot()

    expect(await findByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
  }, 10000)
})
